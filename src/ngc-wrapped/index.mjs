/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// `tsc-wrapped` helpers are not exposed in the primary `@bazel/concatjs` entry-point.
import * as ng from '@angular/compiler-cli';
import { PerfPhase } from '@angular/compiler-cli/private/bazel';
import tscw from '@bazel/concatjs/internal/tsc_wrapped/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as tsickle from 'tsickle';
import ts from 'typescript';
const EXT = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
const NGC_GEN_FILES = /^(.*?)\.(ngfactory|ngsummary|ngstyle|shim\.ngstyle)(.*)$/;
// FIXME: we should be able to add the assets to the tsconfig so FileLoader
// knows about them
const NGC_ASSETS = /\.(css|html|ngsummary\.json)$/;
const BAZEL_BIN = /\b(blaze|bazel)-out\b.*?\bbin\b/;
// Note: We compile the content of node_modules with plain ngc command line.
const ALL_DEPS_COMPILED_WITH_BAZEL = false;
const NODE_MODULES = 'node_modules/';
export async function main(args) {
    if (tscw.runAsWorker(args)) {
        await tscw.runWorkerLoop(runOneBuild);
    }
    else {
        return await runOneBuild(args) ? 0 : 1;
    }
    return 0;
}
/** The one FileCache instance used in this process. */
const fileCache = new tscw.FileCache(tscw.debug);
export async function runOneBuild(args, inputs) {
    if (args[0] === '-p') {
        args.shift();
    }
    // Strip leading at-signs, used to indicate a params file
    const project = args[0].replace(/^@+/, '');
    const [parsedOptions, errors] = tscw.parseTsconfig(project);
    if (errors?.length) {
        console.error(ng.formatDiagnostics(errors));
        return false;
    }
    if (parsedOptions === null) {
        console.error('Could not parse tsconfig. No parse diagnostics provided.');
        return false;
    }
    const { bazelOpts, options: tsOptions, files, config } = parsedOptions;
    const { errors: userErrors, options: userOptions } = ng.readConfiguration(project);
    if (userErrors?.length) {
        console.error(ng.formatDiagnostics(userErrors));
        return false;
    }
    const allowedNgCompilerOptionsOverrides = new Set([
        'diagnostics',
        'trace',
        'disableExpressionLowering',
        'disableTypeScriptVersionCheck',
        'i18nOutLocale',
        'i18nOutFormat',
        'i18nOutFile',
        'i18nInLocale',
        'i18nInFile',
        'i18nInFormat',
        'i18nUseExternalIds',
        'i18nInMissingTranslations',
        'preserveWhitespaces',
        'createExternalSymbolFactoryReexports',
        'extendedDiagnostics',
    ]);
    const userOverrides = Object.entries(userOptions)
        .filter(([key]) => allowedNgCompilerOptionsOverrides.has(key))
        .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
    }, {});
    // Angular Compiler options are always set under Bazel. See `ng_module.bzl`.
    const angularConfigRawOptions = config['angularCompilerOptions'];
    const compilerOpts = {
        ...userOverrides,
        ...angularConfigRawOptions,
        ...tsOptions,
    };
    // These are options passed through from the `ng_module` rule which aren't supported
    // by the `@angular/compiler-cli` and are only intended for `ngc-wrapped`.
    const { expectedOut, _useManifestPathsAsModuleName } = angularConfigRawOptions;
    const tsHost = ts.createCompilerHost(compilerOpts, true);
    const { diagnostics } = compile({
        allDepsCompiledWithBazel: ALL_DEPS_COMPILED_WITH_BAZEL,
        useManifestPathsAsModuleName: _useManifestPathsAsModuleName,
        expectedOuts: expectedOut,
        compilerOpts,
        tsHost,
        bazelOpts,
        files,
        inputs,
    });
    if (diagnostics.length) {
        console.error(ng.formatDiagnostics(diagnostics));
    }
    return diagnostics.every(d => d.category !== ts.DiagnosticCategory.Error);
}
export function relativeToRootDirs(filePath, rootDirs) {
    if (!filePath)
        return filePath;
    // NB: the rootDirs should have been sorted longest-first
    for (let i = 0; i < rootDirs.length; i++) {
        const dir = rootDirs[i];
        const rel = path.posix.relative(dir, filePath);
        if (rel.indexOf('.') != 0)
            return rel;
    }
    return filePath;
}
export function compile({ allDepsCompiledWithBazel = true, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost, }) {
    let fileLoader;
    // These options are expected to be set in Bazel. See:
    // https://github.com/bazelbuild/rules_nodejs/blob/591e76edc9ee0a71d604c5999af8bad7909ef2d4/packages/concatjs/internal/common/tsconfig.bzl#L246.
    const baseUrl = compilerOpts.baseUrl;
    const rootDir = compilerOpts.rootDir;
    const rootDirs = compilerOpts.rootDirs;
    if (bazelOpts.maxCacheSizeMb !== undefined) {
        const maxCacheSizeBytes = bazelOpts.maxCacheSizeMb * (1 << 20);
        fileCache.setMaxCacheSize(maxCacheSizeBytes);
    }
    else {
        fileCache.resetMaxCacheSize();
    }
    if (inputs) {
        fileLoader = new tscw.CachedFileLoader(fileCache);
        // Resolve the inputs to absolute paths to match TypeScript internals
        const resolvedInputs = new Map();
        const inputKeys = Object.keys(inputs);
        for (let i = 0; i < inputKeys.length; i++) {
            const key = inputKeys[i];
            resolvedInputs.set(tscw.resolveNormalizedPath(key), inputs[key]);
        }
        fileCache.updateCache(resolvedInputs);
    }
    else {
        fileLoader = new tscw.UncachedFileLoader();
    }
    // Detect from compilerOpts whether the entrypoint is being invoked in Ivy mode.
    if (!compilerOpts.rootDirs) {
        throw new Error('rootDirs is not set!');
    }
    const bazelBin = compilerOpts.rootDirs.find(rootDir => BAZEL_BIN.test(rootDir));
    if (!bazelBin) {
        throw new Error(`Couldn't find bazel bin in the rootDirs: ${compilerOpts.rootDirs}`);
    }
    const expectedOutsSet = new Set(expectedOuts.map(p => convertToForwardSlashPath(p)));
    const originalWriteFile = tsHost.writeFile.bind(tsHost);
    tsHost.writeFile =
        (fileName, content, writeByteOrderMark, onError, sourceFiles) => {
            const relative = relativeToRootDirs(convertToForwardSlashPath(fileName), [rootDir]);
            if (expectedOutsSet.has(relative)) {
                expectedOutsSet.delete(relative);
                originalWriteFile(fileName, content, writeByteOrderMark, onError, sourceFiles);
            }
        };
    if (!bazelHost) {
        bazelHost = new tscw.CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader);
    }
    const delegate = bazelHost.shouldSkipTsickleProcessing.bind(bazelHost);
    bazelHost.shouldSkipTsickleProcessing = (fileName) => {
        // The base implementation of shouldSkipTsickleProcessing checks whether `fileName` is part of
        // the original `srcs[]`. For Angular (Ivy) compilations, ngfactory/ngsummary files that are
        // shims for original .ts files in the program should be treated identically. Thus, strip the
        // '.ngfactory' or '.ngsummary' part of the filename away before calling the delegate.
        return delegate(fileName.replace(/\.(ngfactory|ngsummary)\.ts$/, '.ts'));
    };
    // By default, disable tsickle decorator transforming in the tsickle compiler host.
    // The Angular compilers have their own logic for decorator processing and we wouldn't
    // want tsickle to interfere with that.
    bazelHost.transformDecorators = false;
    // By default in the `prodmode` output, we do not add annotations for closure compiler.
    // Though, if we are building inside `google3`, closure annotations are desired for
    // prodmode output, so we enable it by default. The defaults can be overridden by
    // setting the `annotateForClosureCompiler` compiler option in the user tsconfig.
    if (!bazelOpts.es5Mode && !bazelOpts.devmode) {
        if (bazelOpts.workspaceName === 'google3') {
            compilerOpts.annotateForClosureCompiler = true;
            // Enable the tsickle decorator transform in google3 with Ivy mode enabled. The tsickle
            // decorator transformation is still needed. This might be because of custom decorators
            // with the `@Annotation` JSDoc that will be processed by the tsickle decorator transform.
            // TODO: Figure out why this is needed in g3 and how we can improve this. FW-2225
            bazelHost.transformDecorators = true;
        }
        else {
            compilerOpts.annotateForClosureCompiler = false;
        }
    }
    // The `annotateForClosureCompiler` Angular compiler option is not respected by default
    // as ngc-wrapped handles tsickle emit on its own. This means that we need to update
    // the tsickle compiler host based on the `annotateForClosureCompiler` flag.
    if (compilerOpts.annotateForClosureCompiler) {
        bazelHost.transformTypesToClosure = true;
    }
    // Patch fileExists when resolving modules, so that CompilerHost can ask TypeScript to
    // resolve non-existing generated files that don't exist on disk, but are
    // synthetic and added to the `programWithStubs` based on real inputs.
    const origBazelHostFileExist = bazelHost.fileExists;
    bazelHost.fileExists = (fileName) => {
        const match = NGC_GEN_FILES.exec(fileName);
        if (match) {
            const [, file, suffix, ext] = match;
            // Performance: skip looking for files other than .d.ts or .ts
            if (ext !== '.ts' && ext !== '.d.ts')
                return false;
            if (suffix.indexOf('ngstyle') >= 0) {
                // Look for foo.css on disk
                fileName = file;
            }
            else {
                // Look for foo.d.ts or foo.ts on disk
                fileName = file + (ext || '');
            }
        }
        if (NGC_ASSETS.test(fileName)) {
            return tsHost.fileExists(fileName);
        }
        return origBazelHostFileExist.call(bazelHost, fileName);
    };
    const origBazelHostShouldNameModule = bazelHost.shouldNameModule.bind(bazelHost);
    bazelHost.shouldNameModule = (fileName) => {
        const flatModuleOutPath = path.posix.join(bazelOpts.package, compilerOpts.flatModuleOutFile + '.ts');
        // The bundle index file is synthesized in bundle_index_host so it's not in the
        // compilationTargetSrc.
        // However we still want to give it an AMD module name for devmode.
        // We can't easily tell which file is the synthetic one, so we build up the path we expect
        // it to have and compare against that.
        if (fileName === path.posix.join(baseUrl, flatModuleOutPath))
            return true;
        // Also handle the case the target is in an external repository.
        // Pull the workspace name from the target which is formatted as `@wksp//package:target`
        // if it the target is from an external workspace. If the target is from the local
        // workspace then it will be formatted as `//package:target`.
        const targetWorkspace = bazelOpts.target.split('/')[0].replace(/^@/, '');
        if (targetWorkspace &&
            fileName === path.posix.join(baseUrl, 'external', targetWorkspace, flatModuleOutPath))
            return true;
        return origBazelHostShouldNameModule(fileName) || NGC_GEN_FILES.test(fileName);
    };
    const ngHost = ng.createCompilerHost({ options: compilerOpts, tsHost: bazelHost });
    patchNgHostWithFileNameToModuleName(ngHost, compilerOpts, bazelOpts, rootDirs, !!useManifestPathsAsModuleName);
    ngHost.toSummaryFileName = (fileName, referringSrcFileName) => path.posix.join(bazelOpts.workspaceName, relativeToRootDirs(fileName, rootDirs).replace(EXT, ''));
    if (allDepsCompiledWithBazel) {
        // Note: The default implementation would work as well,
        // but we can be faster as we know how `toSummaryFileName` works.
        // Note: We can't do this if some deps have been compiled with the command line,
        // as that has a different implementation of fromSummaryFileName / toSummaryFileName
        ngHost.fromSummaryFileName = (fileName, referringLibFileName) => {
            const workspaceRelative = fileName.split('/').splice(1).join('/');
            return tscw.resolveNormalizedPath(bazelBin, workspaceRelative) + '.d.ts';
        };
    }
    // Patch a property on the ngHost that allows the resourceNameToModuleName function to
    // report better errors.
    ngHost.reportMissingResource = (resourceName) => {
        console.error(`\nAsset not found:\n  ${resourceName}`);
        console.error('Check that it\'s included in the `assets` attribute of the `ng_module` rule.\n');
    };
    const emitCallback = ({ program, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers = {}, }) => tsickle.emitWithTsickle(program, bazelHost, bazelHost, compilerOpts, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, {
        beforeTs: customTransformers.before,
        afterTs: customTransformers.after,
        afterDeclarations: customTransformers.afterDeclarations,
    });
    if (!gatherDiagnostics) {
        gatherDiagnostics = (program) => gatherDiagnosticsForInputsOnly(compilerOpts, bazelOpts, program);
    }
    const { diagnostics, emitResult, program } = ng.performCompilation({
        rootNames: files,
        options: compilerOpts,
        host: ngHost,
        emitCallback,
        mergeEmitResultsCallback: tsickle.mergeEmitResults,
        gatherDiagnostics
    });
    const tsickleEmitResult = emitResult;
    let externs = '/** @externs */\n';
    const hasError = diagnostics.some((diag) => diag.category === ts.DiagnosticCategory.Error);
    if (!hasError) {
        if (bazelOpts.tsickleGenerateExterns) {
            externs += tsickle.getGeneratedExterns(tsickleEmitResult.externs, rootDir);
        }
        if (bazelOpts.manifest) {
            const manifest = tscw.constructManifest(tsickleEmitResult.modulesManifest, bazelHost);
            fs.writeFileSync(bazelOpts.manifest, manifest);
        }
    }
    // If compilation fails unexpectedly, performCompilation returns no program.
    // Make sure not to crash but report the diagnostics.
    if (!program)
        return { program, diagnostics };
    if (bazelOpts.tsickleExternsPath) {
        // Note: when tsickleExternsPath is provided, we always write a file as a
        // marker that compilation succeeded, even if it's empty (just containing an
        // @externs).
        fs.writeFileSync(bazelOpts.tsickleExternsPath, externs);
    }
    // There might be some expected output files that are not written by the
    // compiler. In this case, just write an empty file.
    for (const fileName of expectedOutsSet) {
        originalWriteFile(fileName, '', false);
    }
    if (!compilerOpts.noEmit) {
        maybeWriteUnusedInputsList(program.getTsProgram(), rootDir, bazelOpts);
    }
    return { program, diagnostics };
}
/**
 * Writes a collection of unused input files and directories which can be
 * consumed by bazel to avoid triggering rebuilds if only unused inputs are
 * changed.
 *
 * See https://bazel.build/contribute/codebase#input-discovery
 */
export function maybeWriteUnusedInputsList(program, rootDir, bazelOpts) {
    if (!bazelOpts?.unusedInputsListPath) {
        return;
    }
    if (bazelOpts.allowedInputs === undefined) {
        throw new Error('`unusedInputsListPath` is set, but no list of allowed inputs provided.');
    }
    // ts.Program's getSourceFiles() gets populated by the sources actually
    // loaded while the program is being built.
    const usedFiles = new Set();
    for (const sourceFile of program.getSourceFiles()) {
        // Only concern ourselves with typescript files.
        usedFiles.add(sourceFile.fileName);
    }
    // allowedInputs are absolute paths to files which may also end with /* which
    // implies any files in that directory can be used.
    const unusedInputs = [];
    for (const f of bazelOpts.allowedInputs) {
        // A ts/x file is unused if it was not found directly in the used sources.
        if ((f.endsWith('.ts') || f.endsWith('.tsx')) && !usedFiles.has(f)) {
            unusedInputs.push(f);
            continue;
        }
        // TODO: Iterate over contents of allowed directories checking for used files.
    }
    // Bazel expects the unused input list to contain paths relative to the
    // execroot directory.
    // See https://docs.bazel.build/versions/main/output_directories.html
    fs.writeFileSync(bazelOpts.unusedInputsListPath, unusedInputs.map(f => path.relative(rootDir, f)).join('\n'));
}
function isCompilationTarget(bazelOpts, sf) {
    return !NGC_GEN_FILES.test(sf.fileName) &&
        (bazelOpts.compilationTargetSrc.indexOf(sf.fileName) !== -1);
}
function convertToForwardSlashPath(filePath) {
    return filePath.replace(/\\/g, '/');
}
function gatherDiagnosticsForInputsOnly(options, bazelOpts, ngProgram) {
    const tsProgram = ngProgram.getTsProgram();
    // For the Ivy compiler, track the amount of time spent fetching TypeScript diagnostics.
    let previousPhase = PerfPhase.Unaccounted;
    if (ngProgram instanceof ng.NgtscProgram) {
        previousPhase = ngProgram.compiler.perfRecorder.phase(PerfPhase.TypeScriptDiagnostics);
    }
    const diagnostics = [];
    // These checks mirror ts.getPreEmitDiagnostics, with the important
    // exception of avoiding b/30708240, which is that if you call
    // program.getDeclarationDiagnostics() it somehow corrupts the emit.
    diagnostics.push(...tsProgram.getOptionsDiagnostics());
    diagnostics.push(...tsProgram.getGlobalDiagnostics());
    const programFiles = tsProgram.getSourceFiles().filter(f => isCompilationTarget(bazelOpts, f));
    for (let i = 0; i < programFiles.length; i++) {
        const sf = programFiles[i];
        // Note: We only get the diagnostics for individual files
        // to e.g. not check libraries.
        diagnostics.push(...tsProgram.getSyntacticDiagnostics(sf));
        diagnostics.push(...tsProgram.getSemanticDiagnostics(sf));
    }
    if (ngProgram instanceof ng.NgtscProgram) {
        ngProgram.compiler.perfRecorder.phase(previousPhase);
    }
    if (!diagnostics.length) {
        // only gather the angular diagnostics if we have no diagnostics
        // in any other files.
        diagnostics.push(...ngProgram.getNgStructuralDiagnostics());
        diagnostics.push(...ngProgram.getNgSemanticDiagnostics());
    }
    return diagnostics;
}
/**
 * Adds support for the optional `fileNameToModuleName` operation to a given `ng.CompilerHost`.
 *
 * This is used within `ngc-wrapped` and the Bazel compilation flow, but is exported here to allow
 * for other consumers of the compiler to access this same logic. For example, the xi18n operation
 * in g3 configures its own `ng.CompilerHost` which also requires `fileNameToModuleName` to work
 * correctly.
 */
export function patchNgHostWithFileNameToModuleName(ngHost, compilerOpts, bazelOpts, rootDirs, useManifestPathsAsModuleName) {
    const fileNameToModuleNameCache = new Map();
    ngHost.fileNameToModuleName = (importedFilePath, containingFilePath) => {
        const cacheKey = `${importedFilePath}:${containingFilePath}`;
        // Memoize this lookup to avoid expensive re-parses of the same file
        // When run as a worker, the actual ts.SourceFile is cached
        // but when we don't run as a worker, there is no cache.
        // For one example target in g3, we saw a cache hit rate of 7590/7695
        if (fileNameToModuleNameCache.has(cacheKey)) {
            return fileNameToModuleNameCache.get(cacheKey);
        }
        const result = doFileNameToModuleName(importedFilePath, containingFilePath);
        fileNameToModuleNameCache.set(cacheKey, result);
        return result;
    };
    function doFileNameToModuleName(importedFilePath, containingFilePath) {
        const relativeTargetPath = relativeToRootDirs(importedFilePath, rootDirs).replace(EXT, '');
        const manifestTargetPath = `${bazelOpts.workspaceName}/${relativeTargetPath}`;
        if (useManifestPathsAsModuleName === true) {
            return manifestTargetPath;
        }
        // Unless manifest paths are explicitly enforced, we initially check if a module name is
        // set for the given source file. The compiler host from `@bazel/concatjs` sets source
        // file module names if the compilation targets either UMD or AMD. To ensure that the AMD
        // module names match, we first consider those.
        try {
            const sourceFile = ngHost.getSourceFile(importedFilePath, ts.ScriptTarget.Latest);
            if (sourceFile && sourceFile.moduleName) {
                return sourceFile.moduleName;
            }
        }
        catch (err) {
            // File does not exist or parse error. Ignore this case and continue onto the
            // other methods of resolving the module below.
        }
        // It can happen that the ViewEngine compiler needs to write an import in a factory file,
        // and is using an ngsummary file to get the symbols.
        // The ngsummary comes from an upstream ng_module rule.
        // The upstream rule based its imports on ngsummary file which was generated from a
        // metadata.json file that was published to npm in an Angular library.
        // However, the ngsummary doesn't propagate the 'importAs' from the original metadata.json
        // so we would normally not be able to supply the correct module name for it.
        // For example, if the rootDir-relative filePath is
        //  node_modules/@angular/material/toolbar/typings/index
        // we would supply a module name
        //  @angular/material/toolbar/typings/index
        // but there is no JavaScript file to load at this path.
        // This is a workaround for https://github.com/angular/angular/issues/29454
        if (importedFilePath.indexOf('node_modules') >= 0) {
            const maybeMetadataFile = importedFilePath.replace(EXT, '') + '.metadata.json';
            if (fs.existsSync(maybeMetadataFile)) {
                const moduleName = JSON.parse(fs.readFileSync(maybeMetadataFile, { encoding: 'utf-8' })).importAs;
                if (moduleName) {
                    return moduleName;
                }
            }
        }
        if ((compilerOpts.module === ts.ModuleKind.UMD || compilerOpts.module === ts.ModuleKind.AMD) &&
            ngHost.amdModuleName) {
            const amdName = ngHost.amdModuleName({ fileName: importedFilePath });
            if (amdName !== undefined) {
                return amdName;
            }
        }
        // If no AMD module name has been set for the source file by the `@bazel/concatjs` compiler
        // host, and the target file is not part of a flat module node module package, we use the
        // following rules (in order):
        //    1. If target file is part of `node_modules/`, we use the package module name.
        //    2. If no containing file is specified, or the target file is part of a different
        //       compilation unit, we use a Bazel manifest path. Relative paths are not possible
        //       since we don't have a containing file, and the target file could be located in the
        //       output directory, or in an external Bazel repository.
        //    3. If both rules above didn't match, we compute a relative path between the source files
        //       since they are part of the same compilation unit.
        // Note that we don't want to always use (2) because it could mean that compilation outputs
        // are always leaking Bazel-specific paths, and the output is not self-contained. This could
        // break `esm2015` or `esm5` output for Angular package release output
        // Omit the `node_modules` prefix if the module name of an NPM package is requested.
        if (relativeTargetPath.startsWith(NODE_MODULES)) {
            return relativeTargetPath.slice(NODE_MODULES.length);
        }
        else if (containingFilePath == null || !bazelOpts.compilationTargetSrc.includes(importedFilePath)) {
            return manifestTargetPath;
        }
        const containingFileDir = path.dirname(relativeToRootDirs(containingFilePath, rootDirs));
        const relativeImportPath = path.posix.relative(containingFileDir, relativeTargetPath);
        return relativeImportPath.startsWith('.') ? relativeImportPath : `./${relativeImportPath}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0ZBQXNGO0FBQ3RGLE9BQU8sS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sSUFBSSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sS0FBSyxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBQ25DLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQVE1QixNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztBQUMvQyxNQUFNLGFBQWEsR0FBRywwREFBMEQsQ0FBQztBQUNqRiwyRUFBMkU7QUFDM0UsbUJBQW1CO0FBQ25CLE1BQU0sVUFBVSxHQUFHLCtCQUErQixDQUFDO0FBRW5ELE1BQU0sU0FBUyxHQUFHLGlDQUFpQyxDQUFDO0FBRXBELDRFQUE0RTtBQUM1RSxNQUFNLDRCQUE0QixHQUFHLEtBQUssQ0FBQztBQUUzQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7QUFFckMsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsSUFBYztJQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDMUIsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0tBQ3ZDO1NBQU07UUFDTCxPQUFPLE1BQU0sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN4QztJQUNELE9BQU8s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QUFDLENBQUM7UUFDdEYsT0FBTyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxLQUFLLGtCQUFrQixFQUFFLENBQUM7SUFDN0YsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8gYHRzYy13cmFwcGVkYCBoZWxwZXJzIGFyZSBub3QgZXhwb3NlZCBpbiB0aGUgcHJpbWFyeSBgQGJhemVsL2NvbmNhdGpzYCBlbnRyeS1wb2ludC5cbmltcG9ydCAqIGFzIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQge1BlcmZQaGFzZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3ByaXZhdGUvYmF6ZWwnO1xuaW1wb3J0IHRzY3cgZnJvbSAnQGJhemVsL2NvbmNhdGpzL2ludGVybmFsL3RzY193cmFwcGVkL2luZGV4LmpzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG4vLyBBZGQgZGV2bW9kZSBmb3IgYmxhemUgaW50ZXJuYWxcbmludGVyZmFjZSBCYXplbE9wdGlvbnMgZXh0ZW5kcyB0c2N3LkJhemVsT3B0aW9ucyB7XG4gIGFsbG93ZWRJbnB1dHM/OiBzdHJpbmdbXTtcbiAgdW51c2VkSW5wdXRzTGlzdFBhdGg/OiBzdHJpbmc7XG59XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJnczogc3RyaW5nW10pIHtcbiAgaWYgKHRzY3cucnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCB0c2N3LnJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhd2FpdCBydW5PbmVCdWlsZChhcmdzKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgdHNjdy5GaWxlQ2FjaGU8dHMuU291cmNlRmlsZT4odHNjdy5kZWJ1Zyk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChcbiAgICBhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSB7XG4gICAgYXJncy5zaGlmdCgpO1xuICB9XG5cbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHRzY3cucGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHBhcnNlZE9wdGlvbnMgPT09IG51bGwpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgcGFyc2UgdHNjb25maWcuIE5vIHBhcnNlIGRpYWdub3N0aWNzIHByb3ZpZGVkLicpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICAgICdleHRlbmRlZERpYWdub3N0aWNzJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwge30gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuXG4gIC8vIEFuZ3VsYXIgQ29tcGlsZXIgb3B0aW9ucyBhcmUgYWx3YXlzIHNldCB1bmRlciBCYXplbC4gU2VlIGBuZ19tb2R1bGUuYnpsYC5cbiAgY29uc3QgYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMgPVxuICAgICAgKGNvbmZpZyBhcyB7YW5ndWxhckNvbXBpbGVyT3B0aW9uczogbmcuQW5ndWxhckNvbXBpbGVyT3B0aW9uc30pWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ107XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBuZy5Bbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMsXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGFuZ3VsYXJDb25maWdSYXdPcHRpb25zO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVQYXRoOiBzdHJpbmcsIHJvb3REaXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmICghZmlsZVBhdGgpIHJldHVybiBmaWxlUGF0aDtcbiAgLy8gTkI6IHRoZSByb290RGlycyBzaG91bGQgaGF2ZSBiZWVuIHNvcnRlZCBsb25nZXN0LWZpcnN0XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcm9vdERpcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBkaXIgPSByb290RGlyc1tpXTtcbiAgICBjb25zdCByZWwgPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGRpciwgZmlsZVBhdGgpO1xuICAgIGlmIChyZWwuaW5kZXhPZignLicpICE9IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdCxcbn06IHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsPzogYm9vbGVhbixcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZT86IGJvb2xlYW4sIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLCB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCxcbiAgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICAgICAgZmlsZXM6IHN0cmluZ1tdLFxuICAgICAgICBleHBlY3RlZE91dHM6IHN0cmluZ1tdLFxuICBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiByZWFkb25seSB0cy5EaWFnbm9zdGljW10sXG4gIGJhemVsSG9zdD86IHRzY3cuQ29tcGlsZXJIb3N0LFxufSk6IHtkaWFnbm9zdGljczogcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfHVuZGVmaW5lZH0ge1xuICBsZXQgZmlsZUxvYWRlcjogdHNjdy5GaWxlTG9hZGVyO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHNldCBpbiBCYXplbC4gU2VlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9ydWxlc19ub2RlanMvYmxvYi81OTFlNzZlZGM5ZWUwYTcxZDYwNGM1OTk5YWY4YmFkNzkwOWVmMmQ0L3BhY2thZ2VzL2NvbmNhdGpzL2ludGVybmFsL2NvbW1vbi90c2NvbmZpZy5iemwjTDI0Ni5cbiAgY29uc3QgYmFzZVVybCA9IGNvbXBpbGVyT3B0cy5iYXNlVXJsITtcbiAgY29uc3Qgcm9vdERpciA9IGNvbXBpbGVyT3B0cy5yb290RGlyITtcbiAgY29uc3Qgcm9vdERpcnMgPSBjb21waWxlck9wdHMucm9vdERpcnMhO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgdHNjdy5DYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzLnNldCh0c2N3LnJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyB0c2N3LlVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IGZyb20gY29tcGlsZXJPcHRzIHdoZXRoZXIgdGhlIGVudHJ5cG9pbnQgaXMgYmVpbmcgaW52b2tlZCBpbiBJdnkgbW9kZS5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0c1NldCA9IG5ldyBTZXQoZXhwZWN0ZWRPdXRzLm1hcChwID0+IGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgocCkpKTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiByZWFkb25seSB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtyb290RGlyXSk7XG4gICAgICAgIGlmIChleHBlY3RlZE91dHNTZXQuaGFzKHJlbGF0aXZlKSkge1xuICAgICAgICAgIGV4cGVjdGVkT3V0c1NldC5kZWxldGUocmVsYXRpdmUpO1xuICAgICAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICBpZiAoIWJhemVsSG9zdCkge1xuICAgIGJhemVsSG9zdCA9IG5ldyB0c2N3LkNvbXBpbGVySG9zdChmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlcik7XG4gIH1cblxuICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAvLyBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBzaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgY2hlY2tzIHdoZXRoZXIgYGZpbGVOYW1lYCBpcyBwYXJ0IG9mXG4gICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAvLyBzaGltcyBmb3Igb3JpZ2luYWwgLnRzIGZpbGVzIGluIHRoZSBwcm9ncmFtIHNob3VsZCBiZSB0cmVhdGVkIGlkZW50aWNhbGx5LiBUaHVzLCBzdHJpcCB0aGVcbiAgICAvLyAnLm5nZmFjdG9yeScgb3IgJy5uZ3N1bW1hcnknIHBhcnQgb2YgdGhlIGZpbGVuYW1lIGF3YXkgYmVmb3JlIGNhbGxpbmcgdGhlIGRlbGVnYXRlLlxuICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICB9O1xuXG4gIC8vIEJ5IGRlZmF1bHQsIGRpc2FibGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtaW5nIGluIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QuXG4gIC8vIFRoZSBBbmd1bGFyIGNvbXBpbGVycyBoYXZlIHRoZWlyIG93biBsb2dpYyBmb3IgZGVjb3JhdG9yIHByb2Nlc3NpbmcgYW5kIHdlIHdvdWxkbid0XG4gIC8vIHdhbnQgdHNpY2tsZSB0byBpbnRlcmZlcmUgd2l0aCB0aGF0LlxuICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuXG4gIC8vIEJ5IGRlZmF1bHQgaW4gdGhlIGBwcm9kbW9kZWAgb3V0cHV0LCB3ZSBkbyBub3QgYWRkIGFubm90YXRpb25zIGZvciBjbG9zdXJlIGNvbXBpbGVyLlxuICAvLyBUaG91Z2gsIGlmIHdlIGFyZSBidWlsZGluZyBpbnNpZGUgYGdvb2dsZTNgLCBjbG9zdXJlIGFubm90YXRpb25zIGFyZSBkZXNpcmVkIGZvclxuICAvLyBwcm9kbW9kZSBvdXRwdXQsIHNvIHdlIGVuYWJsZSBpdCBieSBkZWZhdWx0LiBUaGUgZGVmYXVsdHMgY2FuIGJlIG92ZXJyaWRkZW4gYnlcbiAgLy8gc2V0dGluZyB0aGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBjb21waWxlciBvcHRpb24gaW4gdGhlIHVzZXIgdHNjb25maWcuXG4gIGlmICghYmF6ZWxPcHRzLmVzNU1vZGUgJiYgIWJhemVsT3B0cy5kZXZtb2RlKSB7XG4gICAgaWYgKGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lID09PSAnZ29vZ2xlMycpIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IHRydWU7XG4gICAgICAvLyBFbmFibGUgdGhlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybSBpbiBnb29nbGUzIHdpdGggSXZ5IG1vZGUgZW5hYmxlZC4gVGhlIHRzaWNrbGVcbiAgICAgIC8vIGRlY29yYXRvciB0cmFuc2Zvcm1hdGlvbiBpcyBzdGlsbCBuZWVkZWQuIFRoaXMgbWlnaHQgYmUgYmVjYXVzZSBvZiBjdXN0b20gZGVjb3JhdG9yc1xuICAgICAgLy8gd2l0aCB0aGUgYEBBbm5vdGF0aW9uYCBKU0RvYyB0aGF0IHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0uXG4gICAgICAvLyBUT0RPOiBGaWd1cmUgb3V0IHdoeSB0aGlzIGlzIG5lZWRlZCBpbiBnMyBhbmQgaG93IHdlIGNhbiBpbXByb3ZlIHRoaXMuIEZXLTIyMjVcbiAgICAgIGJhemVsSG9zdC50cmFuc2Zvcm1EZWNvcmF0b3JzID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgQW5ndWxhciBjb21waWxlciBvcHRpb24gaXMgbm90IHJlc3BlY3RlZCBieSBkZWZhdWx0XG4gIC8vIGFzIG5nYy13cmFwcGVkIGhhbmRsZXMgdHNpY2tsZSBlbWl0IG9uIGl0cyBvd24uIFRoaXMgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHVwZGF0ZVxuICAvLyB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0IGJhc2VkIG9uIHRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIGZsYWcuXG4gIGlmIChjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIpIHtcbiAgICBiYXplbEhvc3QudHJhbnNmb3JtVHlwZXNUb0Nsb3N1cmUgPSB0cnVlO1xuICB9XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gTkdDX0dFTl9GSUxFUy5leGVjKGZpbGVOYW1lKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFssIGZpbGUsIHN1ZmZpeCwgZXh0XSA9IG1hdGNoO1xuICAgICAgLy8gUGVyZm9ybWFuY2U6IHNraXAgbG9va2luZyBmb3IgZmlsZXMgb3RoZXIgdGhhbiAuZC50cyBvciAudHNcbiAgICAgIGlmIChleHQgIT09ICcudHMnICYmIGV4dCAhPT0gJy5kLnRzJykgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1ZmZpeC5pbmRleE9mKCduZ3N0eWxlJykgPj0gMCkge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uY3NzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmQudHMgb3IgZm9vLnRzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlICsgKGV4dCB8fCAnJyk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID1cbiAgICAgICAgcGF0aC5wb3NpeC5qb2luKGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGJhc2VVcmwsIGZsYXRNb2R1bGVPdXRQYXRoKSkgcmV0dXJuIHRydWU7XG5cbiAgICAvLyBBbHNvIGhhbmRsZSB0aGUgY2FzZSB0aGUgdGFyZ2V0IGlzIGluIGFuIGV4dGVybmFsIHJlcG9zaXRvcnkuXG4gICAgLy8gUHVsbCB0aGUgd29ya3NwYWNlIG5hbWUgZnJvbSB0aGUgdGFyZ2V0IHdoaWNoIGlzIGZvcm1hdHRlZCBhcyBgQHdrc3AvL3BhY2thZ2U6dGFyZ2V0YFxuICAgIC8vIGlmIGl0IHRoZSB0YXJnZXQgaXMgZnJvbSBhbiBleHRlcm5hbCB3b3Jrc3BhY2UuIElmIHRoZSB0YXJnZXQgaXMgZnJvbSB0aGUgbG9jYWxcbiAgICAvLyB3b3Jrc3BhY2UgdGhlbiBpdCB3aWxsIGJlIGZvcm1hdHRlZCBhcyBgLy9wYWNrYWdlOnRhcmdldGAuXG4gICAgY29uc3QgdGFyZ2V0V29ya3NwYWNlID0gYmF6ZWxPcHRzLnRhcmdldC5zcGxpdCgnLycpWzBdLnJlcGxhY2UoL15ALywgJycpO1xuXG4gICAgaWYgKHRhcmdldFdvcmtzcGFjZSAmJlxuICAgICAgICBmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICAgICAgbmdIb3N0LCBjb21waWxlck9wdHMsIGJhemVsT3B0cywgcm9vdERpcnMsICEhdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSk7XG5cbiAgbmdIb3N0LnRvU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpID0+IHBhdGgucG9zaXguam9pbihcbiAgICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLCByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIHJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpKTtcbiAgaWYgKGFsbERlcHNDb21waWxlZFdpdGhCYXplbCkge1xuICAgIC8vIE5vdGU6IFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCxcbiAgICAvLyBidXQgd2UgY2FuIGJlIGZhc3RlciBhcyB3ZSBrbm93IGhvdyBgdG9TdW1tYXJ5RmlsZU5hbWVgIHdvcmtzLlxuICAgIC8vIE5vdGU6IFdlIGNhbid0IGRvIHRoaXMgaWYgc29tZSBkZXBzIGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIHRoZSBjb21tYW5kIGxpbmUsXG4gICAgLy8gYXMgdGhhdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgZnJvbVN1bW1hcnlGaWxlTmFtZSAvIHRvU3VtbWFyeUZpbGVOYW1lXG4gICAgbmdIb3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBmaWxlTmFtZS5zcGxpdCgnLycpLnNwbGljZSgxKS5qb2luKCcvJyk7XG4gICAgICByZXR1cm4gdHNjdy5yZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHdvcmtzcGFjZVJlbGF0aXZlKSArICcuZC50cyc7XG4gICAgfTtcbiAgfVxuICAvLyBQYXRjaCBhIHByb3BlcnR5IG9uIHRoZSBuZ0hvc3QgdGhhdCBhbGxvd3MgdGhlIHJlc291cmNlTmFtZVRvTW9kdWxlTmFtZSBmdW5jdGlvbiB0b1xuICAvLyByZXBvcnQgYmV0dGVyIGVycm9ycy5cbiAgKG5nSG9zdCBhcyBhbnkpLnJlcG9ydE1pc3NpbmdSZXNvdXJjZSA9IChyZXNvdXJjZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxcbkFzc2V0IG5vdCBmb3VuZDpcXG4gICR7cmVzb3VyY2VOYW1lfWApO1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoZWNrIHRoYXQgaXRcXCdzIGluY2x1ZGVkIGluIHRoZSBgYXNzZXRzYCBhdHRyaWJ1dGUgb2YgdGhlIGBuZ19tb2R1bGVgIHJ1bGUuXFxuJyk7XG4gIH07XG5cbiAgY29uc3QgZW1pdENhbGxiYWNrOiBuZy5Uc0VtaXRDYWxsYmFjazx0c2lja2xlLkVtaXRSZXN1bHQ+ID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QhLCBiYXplbEhvc3QhLCBjb21waWxlck9wdHMsIHRhcmdldFNvdXJjZUZpbGUsIHdyaXRlRmlsZSxcbiAgICAgICAgICBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywge1xuICAgICAgICAgICAgYmVmb3JlVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5iZWZvcmUsXG4gICAgICAgICAgICBhZnRlclRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXIsXG4gICAgICAgICAgICBhZnRlckRlY2xhcmF0aW9uczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyRGVjbGFyYXRpb25zLFxuICAgICAgICAgIH0pO1xuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0pO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oe1xuICAgIHJvb3ROYW1lczogZmlsZXMsXG4gICAgb3B0aW9uczogY29tcGlsZXJPcHRzLFxuICAgIGhvc3Q6IG5nSG9zdCxcbiAgICBlbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrOiB0c2lja2xlLm1lcmdlRW1pdFJlc3VsdHMsXG4gICAgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGNvbnN0IGhhc0Vycm9yID0gZGlhZ25vc3RpY3Muc29tZSgoZGlhZykgPT4gZGlhZy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbiAgaWYgKCFoYXNFcnJvcikge1xuICAgIGlmIChiYXplbE9wdHMudHNpY2tsZUdlbmVyYXRlRXh0ZXJucykge1xuICAgICAgZXh0ZXJucyArPSB0c2lja2xlLmdldEdlbmVyYXRlZEV4dGVybnModHNpY2tsZUVtaXRSZXN1bHQuZXh0ZXJucywgcm9vdERpcik7XG4gICAgfVxuICAgIGlmIChiYXplbE9wdHMubWFuaWZlc3QpIHtcbiAgICAgIGNvbnN0IG1hbmlmZXN0ID0gdHNjdy5jb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCkge1xuICAgIC8vIE5vdGU6IHdoZW4gdHNpY2tsZUV4dGVybnNQYXRoIGlzIHByb3ZpZGVkLCB3ZSBhbHdheXMgd3JpdGUgYSBmaWxlIGFzIGFcbiAgICAvLyBtYXJrZXIgdGhhdCBjb21waWxhdGlvbiBzdWNjZWVkZWQsIGV2ZW4gaWYgaXQncyBlbXB0eSAoanVzdCBjb250YWluaW5nIGFuXG4gICAgLy8gQGV4dGVybnMpLlxuICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCwgZXh0ZXJucyk7XG4gIH1cblxuICAvLyBUaGVyZSBtaWdodCBiZSBzb21lIGV4cGVjdGVkIG91dHB1dCBmaWxlcyB0aGF0IGFyZSBub3Qgd3JpdHRlbiBieSB0aGVcbiAgLy8gY29tcGlsZXIuIEluIHRoaXMgY2FzZSwganVzdCB3cml0ZSBhbiBlbXB0eSBmaWxlLlxuICBmb3IgKGNvbnN0IGZpbGVOYW1lIG9mIGV4cGVjdGVkT3V0c1NldCkge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCAnJywgZmFsc2UpO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMubm9FbWl0KSB7XG4gICAgbWF5YmVXcml0ZVVudXNlZElucHV0c0xpc3QocHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSwgcm9vdERpciwgYmF6ZWxPcHRzKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG4vKipcbiAqIFdyaXRlcyBhIGNvbGxlY3Rpb24gb2YgdW51c2VkIGlucHV0IGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aGljaCBjYW4gYmVcbiAqIGNvbnN1bWVkIGJ5IGJhemVsIHRvIGF2b2lkIHRyaWdnZXJpbmcgcmVidWlsZHMgaWYgb25seSB1bnVzZWQgaW5wdXRzIGFyZVxuICogY2hhbmdlZC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9iYXplbC5idWlsZC9jb250cmlidXRlL2NvZGViYXNlI2lucHV0LWRpc2NvdmVyeVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVXcml0ZVVudXNlZElucHV0c0xpc3QoXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgcm9vdERpcjogc3RyaW5nLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucykge1xuICBpZiAoIWJhemVsT3B0cz8udW51c2VkSW5wdXRzTGlzdFBhdGgpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGJhemVsT3B0cy5hbGxvd2VkSW5wdXRzID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2B1bnVzZWRJbnB1dHNMaXN0UGF0aGAgaXMgc2V0LCBidXQgbm8gbGlzdCBvZiBhbGxvd2VkIGlucHV0cyBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIHRzLlByb2dyYW0ncyBnZXRTb3VyY2VGaWxlcygpIGdldHMgcG9wdWxhdGVkIGJ5IHRoZSBzb3VyY2VzIGFjdHVhbGx5XG4gIC8vIGxvYWRlZCB3aGlsZSB0aGUgcHJvZ3JhbSBpcyBiZWluZyBidWlsdC5cbiAgY29uc3QgdXNlZEZpbGVzID0gbmV3IFNldCgpO1xuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgLy8gT25seSBjb25jZXJuIG91cnNlbHZlcyB3aXRoIHR5cGVzY3JpcHQgZmlsZXMuXG4gICAgdXNlZEZpbGVzLmFkZChzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgfVxuXG4gIC8vIGFsbG93ZWRJbnB1dHMgYXJlIGFic29sdXRlIHBhdGhzIHRvIGZpbGVzIHdoaWNoIG1heSBhbHNvIGVuZCB3aXRoIC8qIHdoaWNoXG4gIC8vIGltcGxpZXMgYW55IGZpbGVzIGluIHRoYXQgZGlyZWN0b3J5IGNhbiBiZSB1c2VkLlxuICBjb25zdCB1bnVzZWRJbnB1dHM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgZiBvZiBiYXplbE9wdHMuYWxsb3dlZElucHV0cykge1xuICAgIC8vIEEgdHMveCBmaWxlIGlzIHVudXNlZCBpZiBpdCB3YXMgbm90IGZvdW5kIGRpcmVjdGx5IGluIHRoZSB1c2VkIHNvdXJjZXMuXG4gICAgaWYgKChmLmVuZHNXaXRoKCcudHMnKSB8fCBmLmVuZHNXaXRoKCcudHN4JykpICYmICF1c2VkRmlsZXMuaGFzKGYpKSB7XG4gICAgICB1bnVzZWRJbnB1dHMucHVzaChmKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRPRE86IEl0ZXJhdGUgb3ZlciBjb250ZW50cyBvZiBhbGxvd2VkIGRpcmVjdG9yaWVzIGNoZWNraW5nIGZvciB1c2VkIGZpbGVzLlxuICB9XG5cbiAgLy8gQmF6ZWwgZXhwZWN0cyB0aGUgdW51c2VkIGlucHV0IGxpc3QgdG8gY29udGFpbiBwYXRocyByZWxhdGl2ZSB0byB0aGVcbiAgLy8gZXhlY3Jvb3QgZGlyZWN0b3J5LlxuICAvLyBTZWUgaHR0cHM6Ly9kb2NzLmJhemVsLmJ1aWxkL3ZlcnNpb25zL21haW4vb3V0cHV0X2RpcmVjdG9yaWVzLmh0bWxcbiAgZnMud3JpdGVGaWxlU3luYyhcbiAgICAgIGJhemVsT3B0cy51bnVzZWRJbnB1dHNMaXN0UGF0aCwgdW51c2VkSW5wdXRzLm1hcChmID0+IHBhdGgucmVsYXRpdmUocm9vdERpciwgZikpLmpvaW4oJ1xcbicpKTtcbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuICFOR0NfR0VOX0ZJTEVTLnRlc3Qoc2YuZmlsZU5hbWUpICYmXG4gICAgICAoYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluZGV4T2Yoc2YuZmlsZU5hbWUpICE9PSAtMSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgICBvcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBuZ1Byb2dyYW06IG5nLlByb2dyYW0pOiB0cy5EaWFnbm9zdGljW10ge1xuICBjb25zdCB0c1Byb2dyYW0gPSBuZ1Byb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG5cbiAgLy8gRm9yIHRoZSBJdnkgY29tcGlsZXIsIHRyYWNrIHRoZSBhbW91bnQgb2YgdGltZSBzcGVudCBmZXRjaGluZyBUeXBlU2NyaXB0IGRpYWdub3N0aWNzLlxuICBsZXQgcHJldmlvdXNQaGFzZSA9IFBlcmZQaGFzZS5VbmFjY291bnRlZDtcbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIHByZXZpb3VzUGhhc2UgPSBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKFBlcmZQaGFzZS5UeXBlU2NyaXB0RGlhZ25vc3RpY3MpO1xuICB9XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoZiA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgfVxuXG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKHByZXZpb3VzUGhhc2UpO1xuICB9XG5cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbi8qKlxuICogQWRkcyBzdXBwb3J0IGZvciB0aGUgb3B0aW9uYWwgYGZpbGVOYW1lVG9Nb2R1bGVOYW1lYCBvcGVyYXRpb24gdG8gYSBnaXZlbiBgbmcuQ29tcGlsZXJIb3N0YC5cbiAqXG4gKiBUaGlzIGlzIHVzZWQgd2l0aGluIGBuZ2Mtd3JhcHBlZGAgYW5kIHRoZSBCYXplbCBjb21waWxhdGlvbiBmbG93LCBidXQgaXMgZXhwb3J0ZWQgaGVyZSB0byBhbGxvd1xuICogZm9yIG90aGVyIGNvbnN1bWVycyBvZiB0aGUgY29tcGlsZXIgdG8gYWNjZXNzIHRoaXMgc2FtZSBsb2dpYy4gRm9yIGV4YW1wbGUsIHRoZSB4aTE4biBvcGVyYXRpb25cbiAqIGluIGczIGNvbmZpZ3VyZXMgaXRzIG93biBgbmcuQ29tcGlsZXJIb3N0YCB3aGljaCBhbHNvIHJlcXVpcmVzIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgdG8gd29ya1xuICogY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgbmdIb3N0OiBuZy5Db21waWxlckhvc3QsIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICByb290RGlyczogc3RyaW5nW10sIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIG5nSG9zdC5maWxlTmFtZVRvTW9kdWxlTmFtZSA9IChpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNhY2hlS2V5ID0gYCR7aW1wb3J0ZWRGaWxlUGF0aH06JHtjb250YWluaW5nRmlsZVBhdGh9YDtcbiAgICAvLyBNZW1vaXplIHRoaXMgbG9va3VwIHRvIGF2b2lkIGV4cGVuc2l2ZSByZS1wYXJzZXMgb2YgdGhlIHNhbWUgZmlsZVxuICAgIC8vIFdoZW4gcnVuIGFzIGEgd29ya2VyLCB0aGUgYWN0dWFsIHRzLlNvdXJjZUZpbGUgaXMgY2FjaGVkXG4gICAgLy8gYnV0IHdoZW4gd2UgZG9uJ3QgcnVuIGFzIGEgd29ya2VyLCB0aGVyZSBpcyBubyBjYWNoZS5cbiAgICAvLyBGb3Igb25lIGV4YW1wbGUgdGFyZ2V0IGluIGczLCB3ZSBzYXcgYSBjYWNoZSBoaXQgcmF0ZSBvZiA3NTkwLzc2OTVcbiAgICBpZiAoZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5oYXMoY2FjaGVLZXkpKSB7XG4gICAgICByZXR1cm4gZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5nZXQoY2FjaGVLZXkpITtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoLCBjb250YWluaW5nRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGNhY2hlS2V5LCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVsYXRpdmVUYXJnZXRQYXRoID0gcmVsYXRpdmVUb1Jvb3REaXJzKGltcG9ydGVkRmlsZVBhdGgsIHJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpO1xuICAgIGNvbnN0IG1hbmlmZXN0VGFyZ2V0UGF0aCA9IGAke2JhemVsT3B0cy53b3Jrc3BhY2VOYW1lfS8ke3JlbGF0aXZlVGFyZ2V0UGF0aH1gO1xuICAgIGlmICh1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cblxuICAgIC8vIFVubGVzcyBtYW5pZmVzdCBwYXRocyBhcmUgZXhwbGljaXRseSBlbmZvcmNlZCwgd2UgaW5pdGlhbGx5IGNoZWNrIGlmIGEgbW9kdWxlIG5hbWUgaXNcbiAgICAvLyBzZXQgZm9yIHRoZSBnaXZlbiBzb3VyY2UgZmlsZS4gVGhlIGNvbXBpbGVyIGhvc3QgZnJvbSBgQGJhemVsL2NvbmNhdGpzYCBzZXRzIHNvdXJjZVxuICAgIC8vIGZpbGUgbW9kdWxlIG5hbWVzIGlmIHRoZSBjb21waWxhdGlvbiB0YXJnZXRzIGVpdGhlciBVTUQgb3IgQU1ELiBUbyBlbnN1cmUgdGhhdCB0aGUgQU1EXG4gICAgLy8gbW9kdWxlIG5hbWVzIG1hdGNoLCB3ZSBmaXJzdCBjb25zaWRlciB0aG9zZS5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IG5nSG9zdC5nZXRTb3VyY2VGaWxlKGltcG9ydGVkRmlsZVBhdGgsIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QpO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgJiYgc291cmNlRmlsZS5tb2R1bGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlLm1vZHVsZU5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIHBhcnNlIGVycm9yLiBJZ25vcmUgdGhpcyBjYXNlIGFuZCBjb250aW51ZSBvbnRvIHRoZVxuICAgICAgLy8gb3RoZXIgbWV0aG9kcyBvZiByZXNvbHZpbmcgdGhlIG1vZHVsZSBiZWxvdy5cbiAgICB9XG5cbiAgICAvLyBJdCBjYW4gaGFwcGVuIHRoYXQgdGhlIFZpZXdFbmdpbmUgY29tcGlsZXIgbmVlZHMgdG8gd3JpdGUgYW4gaW1wb3J0IGluIGEgZmFjdG9yeSBmaWxlLFxuICAgIC8vIGFuZCBpcyB1c2luZyBhbiBuZ3N1bW1hcnkgZmlsZSB0byBnZXQgdGhlIHN5bWJvbHMuXG4gICAgLy8gVGhlIG5nc3VtbWFyeSBjb21lcyBmcm9tIGFuIHVwc3RyZWFtIG5nX21vZHVsZSBydWxlLlxuICAgIC8vIFRoZSB1cHN0cmVhbSBydWxlIGJhc2VkIGl0cyBpbXBvcnRzIG9uIG5nc3VtbWFyeSBmaWxlIHdoaWNoIHdhcyBnZW5lcmF0ZWQgZnJvbSBhXG4gICAgLy8gbWV0YWRhdGEuanNvbiBmaWxlIHRoYXQgd2FzIHB1Ymxpc2hlZCB0byBucG0gaW4gYW4gQW5ndWxhciBsaWJyYXJ5LlxuICAgIC8vIEhvd2V2ZXIsIHRoZSBuZ3N1bW1hcnkgZG9lc24ndCBwcm9wYWdhdGUgdGhlICdpbXBvcnRBcycgZnJvbSB0aGUgb3JpZ2luYWwgbWV0YWRhdGEuanNvblxuICAgIC8vIHNvIHdlIHdvdWxkIG5vcm1hbGx5IG5vdCBiZSBhYmxlIHRvIHN1cHBseSB0aGUgY29ycmVjdCBtb2R1bGUgbmFtZSBmb3IgaXQuXG4gICAgLy8gRm9yIGV4YW1wbGUsIGlmIHRoZSByb290RGlyLXJlbGF0aXZlIGZpbGVQYXRoIGlzXG4gICAgLy8gIG5vZGVfbW9kdWxlcy9AYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyB3ZSB3b3VsZCBzdXBwbHkgYSBtb2R1bGUgbmFtZVxuICAgIC8vICBAYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyBidXQgdGhlcmUgaXMgbm8gSmF2YVNjcmlwdCBmaWxlIHRvIGxvYWQgYXQgdGhpcyBwYXRoLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy8yOTQ1NFxuICAgIGlmIChpbXBvcnRlZEZpbGVQYXRoLmluZGV4T2YoJ25vZGVfbW9kdWxlcycpID49IDApIHtcbiAgICAgIGNvbnN0IG1heWJlTWV0YWRhdGFGaWxlID0gaW1wb3J0ZWRGaWxlUGF0aC5yZXBsYWNlKEVYVCwgJycpICsgJy5tZXRhZGF0YS5qc29uJztcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKG1heWJlTWV0YWRhdGFGaWxlKSkge1xuICAgICAgICBjb25zdCBtb2R1bGVOYW1lID0gKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG1heWJlTWV0YWRhdGFGaWxlLCB7ZW5jb2Rpbmc6ICd1dGYtOCd9KSkgYXMge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbXBvcnRBczogc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5pbXBvcnRBcztcbiAgICAgICAgaWYgKG1vZHVsZU5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gbW9kdWxlTmFtZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5VTUQgfHwgY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5BTUQpICYmXG4gICAgICAgIG5nSG9zdC5hbWRNb2R1bGVOYW1lKSB7XG4gICAgICBjb25zdCBhbWROYW1lID0gbmdIb3N0LmFtZE1vZHVsZU5hbWUoe2ZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRofSBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgICAgIGlmIChhbWROYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIGFtZE5hbWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gQU1EIG1vZHVsZSBuYW1lIGhhcyBiZWVuIHNldCBmb3IgdGhlIHNvdXJjZSBmaWxlIGJ5IHRoZSBgQGJhemVsL2NvbmNhdGpzYCBjb21waWxlclxuICAgIC8vIGhvc3QsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgaXMgbm90IHBhcnQgb2YgYSBmbGF0IG1vZHVsZSBub2RlIG1vZHVsZSBwYWNrYWdlLCB3ZSB1c2UgdGhlXG4gICAgLy8gZm9sbG93aW5nIHJ1bGVzIChpbiBvcmRlcik6XG4gICAgLy8gICAgMS4gSWYgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBgbm9kZV9tb2R1bGVzL2AsIHdlIHVzZSB0aGUgcGFja2FnZSBtb2R1bGUgbmFtZS5cbiAgICAvLyAgICAyLiBJZiBubyBjb250YWluaW5nIGZpbGUgaXMgc3BlY2lmaWVkLCBvciB0aGUgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBhIGRpZmZlcmVudFxuICAgIC8vICAgICAgIGNvbXBpbGF0aW9uIHVuaXQsIHdlIHVzZSBhIEJhemVsIG1hbmlmZXN0IHBhdGguIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgcG9zc2libGVcbiAgICAvLyAgICAgICBzaW5jZSB3ZSBkb24ndCBoYXZlIGEgY29udGFpbmluZyBmaWxlLCBhbmQgdGhlIHRhcmdldCBmaWxlIGNvdWxkIGJlIGxvY2F0ZWQgaW4gdGhlXG4gICAgLy8gICAgICAgb3V0cHV0IGRpcmVjdG9yeSwgb3IgaW4gYW4gZXh0ZXJuYWwgQmF6ZWwgcmVwb3NpdG9yeS5cbiAgICAvLyAgICAzLiBJZiBib3RoIHJ1bGVzIGFib3ZlIGRpZG4ndCBtYXRjaCwgd2UgY29tcHV0ZSBhIHJlbGF0aXZlIHBhdGggYmV0d2VlbiB0aGUgc291cmNlIGZpbGVzXG4gICAgLy8gICAgICAgc2luY2UgdGhleSBhcmUgcGFydCBvZiB0aGUgc2FtZSBjb21waWxhdGlvbiB1bml0LlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCB3YW50IHRvIGFsd2F5cyB1c2UgKDIpIGJlY2F1c2UgaXQgY291bGQgbWVhbiB0aGF0IGNvbXBpbGF0aW9uIG91dHB1dHNcbiAgICAvLyBhcmUgYWx3YXlzIGxlYWtpbmcgQmF6ZWwtc3BlY2lmaWMgcGF0aHMsIGFuZCB0aGUgb3V0cHV0IGlzIG5vdCBzZWxmLWNvbnRhaW5lZC4gVGhpcyBjb3VsZFxuICAgIC8vIGJyZWFrIGBlc20yMDE1YCBvciBgZXNtNWAgb3V0cHV0IGZvciBBbmd1bGFyIHBhY2thZ2UgcmVsZWFzZSBvdXRwdXRcbiAgICAvLyBPbWl0IHRoZSBgbm9kZV9tb2R1bGVzYCBwcmVmaXggaWYgdGhlIG1vZHVsZSBuYW1lIG9mIGFuIE5QTSBwYWNrYWdlIGlzIHJlcXVlc3RlZC5cbiAgICBpZiAocmVsYXRpdmVUYXJnZXRQYXRoLnN0YXJ0c1dpdGgoTk9ERV9NT0RVTEVTKSkge1xuICAgICAgcmV0dXJuIHJlbGF0aXZlVGFyZ2V0UGF0aC5zbGljZShOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjb250YWluaW5nRmlsZVBhdGggPT0gbnVsbCB8fCAhYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluY2x1ZGVzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgICBjb25zdCBjb250YWluaW5nRmlsZURpciA9IHBhdGguZGlybmFtZShyZWxhdGl2ZVRvUm9vdERpcnMoY29udGFpbmluZ0ZpbGVQYXRoLCByb290RGlycykpO1xuICAgIGNvbnN0IHJlbGF0aXZlSW1wb3J0UGF0aCA9IHBhdGgucG9zaXgucmVsYXRpdmUoY29udGFpbmluZ0ZpbGVEaXIsIHJlbGF0aXZlVGFyZ2V0UGF0aCk7XG4gICAgcmV0dXJuIHJlbGF0aXZlSW1wb3J0UGF0aC5zdGFydHNXaXRoKCcuJykgPyByZWxhdGl2ZUltcG9ydFBhdGggOiBgLi8ke3JlbGF0aXZlSW1wb3J0UGF0aH1gO1xuICB9XG59XG4iXX0=