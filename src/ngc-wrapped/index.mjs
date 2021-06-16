/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ng from '@angular/compiler-cli';
import { PerfPhase } from '@angular/compiler-cli/src/ngtsc/perf';
import { CachedFileLoader, CompilerHost, constructManifest, debug, FileCache, parseTsconfig, resolveNormalizedPath, runAsWorker, runWorkerLoop, UncachedFileLoader } from '@bazel/typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as tsickle from 'tsickle';
import * as ts from 'typescript';
const EXT = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
const NGC_GEN_FILES = /^(.*?)\.(ngfactory|ngsummary|ngstyle|shim\.ngstyle)(.*)$/;
// FIXME: we should be able to add the assets to the tsconfig so FileLoader
// knows about them
const NGC_ASSETS = /\.(css|html|ngsummary\.json)$/;
const BAZEL_BIN = /\b(blaze|bazel)-out\b.*?\bbin\b/;
// Note: We compile the content of node_modules with plain ngc command line.
const ALL_DEPS_COMPILED_WITH_BAZEL = false;
const NODE_MODULES = 'node_modules/';
export function main(args) {
    if (runAsWorker(args)) {
        runWorkerLoop(runOneBuild);
    }
    else {
        return runOneBuild(args) ? 0 : 1;
    }
    return 0;
}
/** The one FileCache instance used in this process. */
const fileCache = new FileCache(debug);
export function runOneBuild(args, inputs) {
    if (args[0] === '-p')
        args.shift();
    // Strip leading at-signs, used to indicate a params file
    const project = args[0].replace(/^@+/, '');
    const [parsedOptions, errors] = parseTsconfig(project);
    if (errors === null || errors === void 0 ? void 0 : errors.length) {
        console.error(ng.formatDiagnostics(errors));
        return false;
    }
    const { bazelOpts, options: tsOptions, files, config } = parsedOptions;
    const { errors: userErrors, options: userOptions } = ng.readConfiguration(project);
    if (userErrors === null || userErrors === void 0 ? void 0 : userErrors.length) {
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
    ]);
    const userOverrides = Object.entries(userOptions)
        .filter(([key]) => allowedNgCompilerOptionsOverrides.has(key))
        .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
    }, {});
    const compilerOpts = Object.assign(Object.assign(Object.assign({}, userOverrides), config['angularCompilerOptions']), tsOptions);
    // These are options passed through from the `ng_module` rule which aren't supported
    // by the `@angular/compiler-cli` and are only intended for `ngc-wrapped`.
    const { expectedOut, _useManifestPathsAsModuleName } = config['angularCompilerOptions'];
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
export function compile({ allDepsCompiledWithBazel = true, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost }) {
    let fileLoader;
    if (bazelOpts.maxCacheSizeMb !== undefined) {
        const maxCacheSizeBytes = bazelOpts.maxCacheSizeMb * (1 << 20);
        fileCache.setMaxCacheSize(maxCacheSizeBytes);
    }
    else {
        fileCache.resetMaxCacheSize();
    }
    if (inputs) {
        fileLoader = new CachedFileLoader(fileCache);
        // Resolve the inputs to absolute paths to match TypeScript internals
        const resolvedInputs = new Map();
        const inputKeys = Object.keys(inputs);
        for (let i = 0; i < inputKeys.length; i++) {
            const key = inputKeys[i];
            resolvedInputs.set(resolveNormalizedPath(key), inputs[key]);
        }
        fileCache.updateCache(resolvedInputs);
    }
    else {
        fileLoader = new UncachedFileLoader();
    }
    // Detect from compilerOpts whether the entrypoint is being invoked in Ivy mode.
    const isInIvyMode = !!compilerOpts.enableIvy;
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
            const relative = relativeToRootDirs(convertToForwardSlashPath(fileName), [compilerOpts.rootDir]);
            if (expectedOutsSet.has(relative)) {
                expectedOutsSet.delete(relative);
                originalWriteFile(fileName, content, writeByteOrderMark, onError, sourceFiles);
            }
        };
    // Patch fileExists when resolving modules, so that CompilerHost can ask TypeScript to
    // resolve non-existing generated files that don't exist on disk, but are
    // synthetic and added to the `programWithStubs` based on real inputs.
    const generatedFileModuleResolverHost = Object.create(tsHost);
    generatedFileModuleResolverHost.fileExists = (fileName) => {
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
        return tsHost.fileExists(fileName);
    };
    function generatedFileModuleResolver(moduleName, containingFile, compilerOptions) {
        return ts.resolveModuleName(moduleName, containingFile, compilerOptions, generatedFileModuleResolverHost);
    }
    if (!bazelHost) {
        bazelHost = new CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader, generatedFileModuleResolver);
    }
    if (isInIvyMode) {
        const delegate = bazelHost.shouldSkipTsickleProcessing.bind(bazelHost);
        bazelHost.shouldSkipTsickleProcessing = (fileName) => {
            // The base implementation of shouldSkipTsickleProcessing checks whether `fileName` is part of
            // the original `srcs[]`. For Angular (Ivy) compilations, ngfactory/ngsummary files that are
            // shims for original .ts files in the program should be treated identically. Thus, strip the
            // '.ngfactory' or '.ngsummary' part of the filename away before calling the delegate.
            return delegate(fileName.replace(/\.(ngfactory|ngsummary)\.ts$/, '.ts'));
        };
    }
    // By default, disable tsickle decorator transforming in the tsickle compiler host.
    // The Angular compilers have their own logic for decorator processing and we wouldn't
    // want tsickle to interfere with that.
    bazelHost.transformDecorators = false;
    // By default in the `prodmode` output, we do not add annotations for closure compiler.
    // Though, if we are building inside `google3`, closure annotations are desired for
    // prodmode output, so we enable it by default. The defaults can be overridden by
    // setting the `annotateForClosureCompiler` compiler option in the user tsconfig.
    if (!bazelOpts.es5Mode) {
        if (bazelOpts.workspaceName === 'google3') {
            compilerOpts.annotateForClosureCompiler = true;
            // Enable the tsickle decorator transform in google3 with Ivy mode enabled. The tsickle
            // decorator transformation is still needed. This might be because of custom decorators
            // with the `@Annotation` JSDoc that will be processed by the tsickle decorator transform.
            // TODO: Figure out why this is needed in g3 and how we can improve this. FW-2225
            if (isInIvyMode) {
                bazelHost.transformDecorators = true;
            }
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
    const origBazelHostFileExist = bazelHost.fileExists;
    bazelHost.fileExists = (fileName) => {
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
        if (fileName === path.posix.join(compilerOpts.baseUrl, flatModuleOutPath))
            return true;
        // Also handle the case the target is in an external repository.
        // Pull the workspace name from the target which is formatted as `@wksp//package:target`
        // if it the target is from an external workspace. If the target is from the local
        // workspace then it will be formatted as `//package:target`.
        const targetWorkspace = bazelOpts.target.split('/')[0].replace(/^@/, '');
        if (targetWorkspace &&
            fileName ===
                path.posix.join(compilerOpts.baseUrl, 'external', targetWorkspace, flatModuleOutPath))
            return true;
        return origBazelHostShouldNameModule(fileName) || NGC_GEN_FILES.test(fileName);
    };
    const ngHost = ng.createCompilerHost({ options: compilerOpts, tsHost: bazelHost });
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
        const relativeTargetPath = relativeToRootDirs(importedFilePath, compilerOpts.rootDirs).replace(EXT, '');
        const manifestTargetPath = `${bazelOpts.workspaceName}/${relativeTargetPath}`;
        if (useManifestPathsAsModuleName === true) {
            return manifestTargetPath;
        }
        // Unless manifest paths are explicitly enforced, we initially check if a module name is
        // set for the given source file. The compiler host from `@bazel/typescript` sets source
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
            return ngHost.amdModuleName({ fileName: importedFilePath });
        }
        // If no AMD module name has been set for the source file by the `@bazel/typescript` compiler
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
            return relativeTargetPath.substr(NODE_MODULES.length);
        }
        else if (containingFilePath == null || !bazelOpts.compilationTargetSrc.includes(importedFilePath)) {
            return manifestTargetPath;
        }
        const containingFileDir = path.dirname(relativeToRootDirs(containingFilePath, compilerOpts.rootDirs));
        const relativeImportPath = path.posix.relative(containingFileDir, relativeTargetPath);
        return relativeImportPath.startsWith('.') ? relativeImportPath : `./${relativeImportPath}`;
    }
    ngHost.toSummaryFileName = (fileName, referringSrcFileName) => path.posix.join(bazelOpts.workspaceName, relativeToRootDirs(fileName, compilerOpts.rootDirs).replace(EXT, ''));
    if (allDepsCompiledWithBazel) {
        // Note: The default implementation would work as well,
        // but we can be faster as we know how `toSummaryFileName` works.
        // Note: We can't do this if some deps have been compiled with the command line,
        // as that has a different implementation of fromSummaryFileName / toSummaryFileName
        ngHost.fromSummaryFileName = (fileName, referringLibFileName) => {
            const workspaceRelative = fileName.split('/').splice(1).join('/');
            return resolveNormalizedPath(bazelBin, workspaceRelative) + '.d.ts';
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
    if (!diagnostics.length) {
        if (bazelOpts.tsickleGenerateExterns) {
            externs += tsickle.getGeneratedExterns(tsickleEmitResult.externs);
        }
        if (bazelOpts.manifest) {
            const manifest = constructManifest(tsickleEmitResult.modulesManifest, bazelHost);
            fs.writeFileSync(bazelOpts.manifest, manifest);
        }
    }
    // If compilation fails unexpectedly, performCompilation returns no program.
    // Make sure not to crash but report the diagnostics.
    if (!program)
        return { program, diagnostics };
    if (!bazelOpts.nodeModulesPrefix) {
        // If there is no node modules, then metadata.json should be emitted since
        // there is no other way to obtain the information
        generateMetadataJson(program.getTsProgram(), files, compilerOpts.rootDirs, bazelBin, tsHost);
    }
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
    return { program, diagnostics };
}
/**
 * Generate metadata.json for the specified `files`. By default, metadata.json
 * is only generated by the compiler if --flatModuleOutFile is specified. But
 * if compiled under blaze, we want the metadata to be generated for each
 * Angular component.
 */
function generateMetadataJson(program, files, rootDirs, bazelBin, tsHost) {
    const collector = new ng.MetadataCollector();
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sourceFile = program.getSourceFile(file);
        if (sourceFile) {
            const metadata = collector.getMetadata(sourceFile);
            if (metadata) {
                const relative = relativeToRootDirs(file, rootDirs);
                const shortPath = relative.replace(EXT, '.metadata.json');
                const outFile = resolveNormalizedPath(bazelBin, shortPath);
                const data = JSON.stringify(metadata);
                tsHost.writeFile(outFile, data, false, undefined, []);
            }
        }
    }
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
if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1QyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDL0QsT0FBTyxFQUFlLGdCQUFnQixFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFjLGFBQWEsRUFBRSxxQkFBcUIsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGtCQUFrQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDdE4sT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFDN0IsT0FBTyxLQUFLLE9BQU8sTUFBTSxTQUFTLENBQUM7QUFDbkMsT0FBTyxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakMsTUFBTSxHQUFHLEdBQUcsa0NBQWtDLENBQUM7QUFDL0MsTUFBTSxhQUFhLEdBQUcsMERBQTBELENBQUM7QUFDakYsMkVBQTJFO0FBQzNFLG1CQUFtQjtBQUNuQixNQUFNLFVBQVUsR0FBRywrQkFBK0IsQ0FBQztBQUVuRCxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztBQUVwRCw0RUFBNEU7QUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7QUFFM0MsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0FBRXJDLE1BQU0sVUFBVSxJQUFJLENBQUMsSUFBSTtJQUN2QixJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNyQixhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDNUI7U0FBTTtRQUNMLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNsQztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELHVEQUF1RDtBQUN2RCxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBZ0IsS0FBSyxDQUFDLENBQUM7QUFFdEQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxJQUFjLEVBQUUsTUFBaUM7SUFDM0UsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSTtRQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNuQyx5REFBeUQ7SUFDekQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFM0MsTUFBTSxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdkQsSUFBSSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsTUFBTSxFQUFFO1FBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDNUMsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELE1BQU0sRUFBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFDLEdBQUcsYUFBYSxDQUFDO0lBQ3JFLE1BQU0sRUFBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUMsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFakYsSUFBSSxVQUFVLGFBQVYsVUFBVSx1QkFBVixVQUFVLENBQUUsTUFBTSxFQUFFO1FBQ3RCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDaEQsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELE1BQU0saUNBQWlDLEdBQUcsSUFBSSxHQUFHLENBQVM7UUFDeEQsYUFBYTtRQUNiLE9BQU87UUFDUCwyQkFBMkI7UUFDM0IsK0JBQStCO1FBQy9CLGVBQWU7UUFDZixlQUFlO1FBQ2YsYUFBYTtRQUNiLGNBQWM7UUFDZCxZQUFZO1FBQ1osY0FBYztRQUNkLG9CQUFvQjtRQUNwQiwyQkFBMkI7UUFDM0IscUJBQXFCO1FBQ3JCLHNDQUFzQztLQUN2QyxDQUFDLENBQUM7SUFFSCxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztTQUN0QixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDN0QsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7UUFDNUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUVqQixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUVqQyxNQUFNLFlBQVksaURBQ2IsYUFBYSxHQUNiLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxHQUNoQyxTQUFTLENBQ2IsQ0FBQztJQUVGLG9GQUFvRjtJQUNwRiwwRUFBMEU7SUFDMUUsTUFBTSxFQUFDLFdBQVcsRUFBRSw2QkFBNkIsRUFBQyxHQUFHLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBRXRGLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekQsTUFBTSxFQUFDLFdBQVcsRUFBQyxHQUFHLE9BQU8sQ0FBQztRQUM1Qix3QkFBd0IsRUFBRSw0QkFBNEI7UUFDdEQsNEJBQTRCLEVBQUUsNkJBQTZCO1FBQzNELFlBQVksRUFBRSxXQUFXO1FBQ3pCLFlBQVk7UUFDWixNQUFNO1FBQ04sU0FBUztRQUNULEtBQUs7UUFDTCxNQUFNO0tBQ1AsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO1FBQ3RCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7S0FDbEQ7SUFDRCxPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsTUFBTSxVQUFVLGtCQUFrQixDQUFDLFFBQWdCLEVBQUUsUUFBa0I7SUFDckUsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUMvQix5REFBeUQ7SUFDekQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDeEMsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMvQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sR0FBRyxDQUFDO0tBQ3ZDO0lBQ0QsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUVELE1BQU0sVUFBVSxPQUFPLENBQUMsRUFDdEIsd0JBQXdCLEdBQUcsSUFBSSxFQUMvQiw0QkFBNEIsRUFDNUIsWUFBWSxFQUNaLE1BQU0sRUFDTixTQUFTLEVBQ1QsS0FBSyxFQUNMLE1BQU0sRUFDTixZQUFZLEVBQ1osaUJBQWlCLEVBQ2pCLFNBQVMsRUFVVjtJQUNDLElBQUksVUFBc0IsQ0FBQztJQUUzQixJQUFJLFNBQVMsQ0FBQyxjQUFjLEtBQUssU0FBUyxFQUFFO1FBQzFDLE1BQU0saUJBQWlCLEdBQUcsU0FBUyxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRCxTQUFTLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLENBQUM7S0FDOUM7U0FBTTtRQUNMLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0tBQy9CO0lBRUQsSUFBSSxNQUFNLEVBQUU7UUFDVixVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QyxxRUFBcUU7UUFDckUsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFDakQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN6QyxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsY0FBYyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztTQUM3RDtRQUNELFNBQVMsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7S0FDdkM7U0FBTTtRQUNMLFVBQVUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7S0FDdkM7SUFFRCxnRkFBZ0Y7SUFDaEYsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7SUFDN0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUU7UUFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0tBQ3pDO0lBQ0QsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDaEYsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUNiLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0tBQ3RGO0lBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVyRixNQUFNLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hELE1BQU0sQ0FBQyxTQUFTO1FBQ1osQ0FBQyxRQUFnQixFQUFFLE9BQWUsRUFBRSxrQkFBMkIsRUFDOUQsT0FBbUMsRUFBRSxXQUE2QixFQUFFLEVBQUU7WUFDckUsTUFBTSxRQUFRLEdBQ1Ysa0JBQWtCLENBQUMseUJBQXlCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNwRixJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ2pDLGVBQWUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ2pDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2FBQ2hGO1FBQ0gsQ0FBQyxDQUFDO0lBRU4sc0ZBQXNGO0lBQ3RGLHlFQUF5RTtJQUN6RSxzRUFBc0U7SUFDdEUsTUFBTSwrQkFBK0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlELCtCQUErQixDQUFDLFVBQVUsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtRQUNoRSxNQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLElBQUksS0FBSyxFQUFFO1lBQ1QsTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDcEMsOERBQThEO1lBQzlELElBQUksR0FBRyxLQUFLLEtBQUssSUFBSSxHQUFHLEtBQUssT0FBTztnQkFBRSxPQUFPLEtBQUssQ0FBQztZQUNuRCxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNsQywyQkFBMkI7Z0JBQzNCLFFBQVEsR0FBRyxJQUFJLENBQUM7YUFDakI7aUJBQU07Z0JBQ0wsc0NBQXNDO2dCQUN0QyxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2FBQy9CO1NBQ0Y7UUFDRCxPQUFPLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDckMsQ0FBQyxDQUFDO0lBRUYsU0FBUywyQkFBMkIsQ0FDaEMsVUFBa0IsRUFBRSxjQUFzQixFQUMxQyxlQUFtQztRQUNyQyxPQUFPLEVBQUUsQ0FBQyxpQkFBaUIsQ0FDdkIsVUFBVSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsK0JBQStCLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBRUQsSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNkLFNBQVMsR0FBRyxJQUFJLFlBQVksQ0FDeEIsS0FBSyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0tBQ3RGO0lBRUQsSUFBSSxXQUFXLEVBQUU7UUFDZixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZFLFNBQVMsQ0FBQywyQkFBMkIsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtZQUMzRCw4RkFBOEY7WUFDOUYsNEZBQTRGO1lBQzVGLDZGQUE2RjtZQUM3RixzRkFBc0Y7WUFDdEYsT0FBTyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzNFLENBQUMsQ0FBQztLQUNIO0lBRUQsbUZBQW1GO0lBQ25GLHNGQUFzRjtJQUN0Rix1Q0FBdUM7SUFDdkMsU0FBUyxDQUFDLG1CQUFtQixHQUFHLEtBQUssQ0FBQztJQUV0Qyx1RkFBdUY7SUFDdkYsbUZBQW1GO0lBQ25GLGlGQUFpRjtJQUNqRixpRkFBaUY7SUFDakYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7UUFDdEIsSUFBSSxTQUFTLENBQUMsYUFBYSxLQUFLLFNBQVMsRUFBRTtZQUN6QyxZQUFZLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDO1lBQy9DLHVGQUF1RjtZQUN2Rix1RkFBdUY7WUFDdkYsMEZBQTBGO1lBQzFGLGlGQUFpRjtZQUNqRixJQUFJLFdBQVcsRUFBRTtnQkFDZixTQUFTLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO2FBQ3RDO1NBQ0Y7YUFBTTtZQUNMLFlBQVksQ0FBQywwQkFBMEIsR0FBRyxLQUFLLENBQUM7U0FDakQ7S0FDRjtJQUVELHVGQUF1RjtJQUN2RixvRkFBb0Y7SUFDcEYsNEVBQTRFO0lBQzVFLElBQUksWUFBWSxDQUFDLDBCQUEwQixFQUFFO1FBQzNDLFNBQVMsQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7S0FDMUM7SUFFRCxNQUFNLHNCQUFzQixHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUM7SUFDcEQsU0FBUyxDQUFDLFVBQVUsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtRQUMxQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDN0IsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3BDO1FBQ0QsT0FBTyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzFELENBQUMsQ0FBQztJQUNGLE1BQU0sNkJBQTZCLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNqRixTQUFTLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7UUFDaEQsTUFBTSxpQkFBaUIsR0FDbkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFFL0UsK0VBQStFO1FBQy9FLHdCQUF3QjtRQUN4QixtRUFBbUU7UUFDbkUsMEZBQTBGO1FBQzFGLHVDQUF1QztRQUN2QyxJQUFJLFFBQVEsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFdkYsZ0VBQWdFO1FBQ2hFLHdGQUF3RjtRQUN4RixrRkFBa0Y7UUFDbEYsNkRBQTZEO1FBQzdELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFekUsSUFBSSxlQUFlO1lBQ2YsUUFBUTtnQkFDSixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLENBQUM7WUFDM0YsT0FBTyxJQUFJLENBQUM7UUFFZCxPQUFPLDZCQUE2QixDQUFDLFFBQVEsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakYsQ0FBQyxDQUFDO0lBRUYsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFDLENBQUMsQ0FBQztJQUNqRixNQUFNLHlCQUF5QixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBQzVELE1BQU0sQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLGdCQUF3QixFQUFFLGtCQUEyQixFQUFFLEVBQUU7UUFDdEYsTUFBTSxRQUFRLEdBQUcsR0FBRyxnQkFBZ0IsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1FBQzdELG9FQUFvRTtRQUNwRSwyREFBMkQ7UUFDM0Qsd0RBQXdEO1FBQ3hELHFFQUFxRTtRQUNyRSxJQUFJLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUMzQyxPQUFPLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNoRDtRQUNELE1BQU0sTUFBTSxHQUFHLHNCQUFzQixDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDNUUseUJBQXlCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNoRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDLENBQUM7SUFFRixTQUFTLHNCQUFzQixDQUFDLGdCQUF3QixFQUFFLGtCQUEyQjtRQUNuRixNQUFNLGtCQUFrQixHQUNwQixrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRixNQUFNLGtCQUFrQixHQUFHLEdBQUcsU0FBUyxDQUFDLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1FBQzlFLElBQUksNEJBQTRCLEtBQUssSUFBSSxFQUFFO1lBQ3pDLE9BQU8sa0JBQWtCLENBQUM7U0FDM0I7UUFFRCx3RkFBd0Y7UUFDeEYsd0ZBQXdGO1FBQ3hGLHlGQUF5RjtRQUN6RiwrQ0FBK0M7UUFDL0MsSUFBSTtZQUNGLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNsRixJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFO2dCQUN2QyxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUM7YUFDOUI7U0FDRjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osNkVBQTZFO1lBQzdFLCtDQUErQztTQUNoRDtRQUVELHlGQUF5RjtRQUN6RixxREFBcUQ7UUFDckQsdURBQXVEO1FBQ3ZELG1GQUFtRjtRQUNuRixzRUFBc0U7UUFDdEUsMEZBQTBGO1FBQzFGLDZFQUE2RTtRQUM3RSxtREFBbUQ7UUFDbkQsd0RBQXdEO1FBQ3hELGdDQUFnQztRQUNoQywyQ0FBMkM7UUFDM0Msd0RBQXdEO1FBQ3hELDJFQUEyRTtRQUMzRSxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakQsTUFBTSxpQkFBaUIsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDO1lBQy9FLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUNwQyxNQUFNLFVBQVUsR0FBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEVBQUUsRUFBQyxRQUFRLEVBQUUsT0FBTyxFQUFDLENBQUMsQ0FFakUsQ0FBQyxRQUFRLENBQUM7Z0JBQy9CLElBQUksVUFBVSxFQUFFO29CQUNkLE9BQU8sVUFBVSxDQUFDO2lCQUNuQjthQUNGO1NBQ0Y7UUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQ3hGLE1BQU0sQ0FBQyxhQUFhLEVBQUU7WUFDeEIsT0FBTyxNQUFNLENBQUMsYUFBYSxDQUFDLEVBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFrQixDQUFDLENBQUM7U0FDNUU7UUFFRCw2RkFBNkY7UUFDN0YseUZBQXlGO1FBQ3pGLDhCQUE4QjtRQUM5QixtRkFBbUY7UUFDbkYsc0ZBQXNGO1FBQ3RGLHdGQUF3RjtRQUN4RiwyRkFBMkY7UUFDM0YsOERBQThEO1FBQzlELDhGQUE4RjtRQUM5RiwwREFBMEQ7UUFDMUQsMkZBQTJGO1FBQzNGLDRGQUE0RjtRQUM1RixzRUFBc0U7UUFDdEUsb0ZBQW9GO1FBQ3BGLElBQUksa0JBQWtCLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQy9DLE9BQU8sa0JBQWtCLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN2RDthQUFNLElBQ0gsa0JBQWtCLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBQzVGLE9BQU8sa0JBQWtCLENBQUM7U0FDM0I7UUFDRCxNQUFNLGlCQUFpQixHQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ2hGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUN0RixPQUFPLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEtBQUssa0JBQWtCLEVBQUUsQ0FBQztJQUM3RixDQUFDO0lBRUQsTUFBTSxDQUFDLGlCQUFpQixHQUFHLENBQUMsUUFBZ0IsRUFBRSxvQkFBNEIsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQzFGLFNBQVMsQ0FBQyxhQUFhLEVBQ3ZCLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzFFLElBQUksd0JBQXdCLEVBQUU7UUFDNUIsdURBQXVEO1FBQ3ZELGlFQUFpRTtRQUNqRSxnRkFBZ0Y7UUFDaEYsb0ZBQW9GO1FBQ3BGLE1BQU0sQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLFFBQWdCLEVBQUUsb0JBQTRCLEVBQUUsRUFBRTtZQUM5RSxNQUFNLGlCQUFpQixHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNsRSxPQUFPLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUN0RSxDQUFDLENBQUM7S0FDSDtJQUNELHNGQUFzRjtJQUN0Rix3QkFBd0I7SUFDdkIsTUFBYyxDQUFDLHFCQUFxQixHQUFHLENBQUMsWUFBb0IsRUFBRSxFQUFFO1FBQy9ELE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDdkQsT0FBTyxDQUFDLEtBQUssQ0FBQyxnRkFBZ0YsQ0FBQyxDQUFDO0lBQ2xHLENBQUMsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFzQixDQUFDLEVBQ3ZDLE9BQU8sRUFDUCxnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULGlCQUFpQixFQUNqQixnQkFBZ0IsRUFDaEIsa0JBQWtCLEdBQUcsRUFBRSxHQUN4QixFQUFFLEVBQUUsQ0FDRCxPQUFPLENBQUMsZUFBZSxDQUNuQixPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUN4RSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRTtRQUNuQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsTUFBTTtRQUNuQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsS0FBSztRQUNqQyxpQkFBaUIsRUFBRSxrQkFBa0IsQ0FBQyxpQkFBaUI7S0FDeEQsQ0FBQyxDQUFDO0lBRVgsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1FBQ3RCLGlCQUFpQixHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FDNUIsOEJBQThCLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztLQUN0RTtJQUNELE1BQU0sRUFBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBQyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztRQUMvRCxTQUFTLEVBQUUsS0FBSztRQUNoQixPQUFPLEVBQUUsWUFBWTtRQUNyQixJQUFJLEVBQUUsTUFBTTtRQUNaLFlBQVk7UUFDWix3QkFBd0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1FBQ2xELGlCQUFpQjtLQUNsQixDQUFDLENBQUM7SUFDSCxNQUFNLGlCQUFpQixHQUFHLFVBQWdDLENBQUM7SUFDM0QsSUFBSSxPQUFPLEdBQUcsbUJBQW1CLENBQUM7SUFDbEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7UUFDdkIsSUFBSSxTQUFTLENBQUMsc0JBQXNCLEVBQUU7WUFDcEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNuRTtRQUNELElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRTtZQUN0QixNQUFNLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDakYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ2hEO0tBQ0Y7SUFFRCw0RUFBNEU7SUFDNUUscURBQXFEO0lBQ3JELElBQUksQ0FBQyxPQUFPO1FBQUUsT0FBTyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQztJQUU1QyxJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixFQUFFO1FBQ2hDLDBFQUEwRTtRQUMxRSxrREFBa0Q7UUFDbEQsb0JBQW9CLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztLQUM5RjtJQUVELElBQUksU0FBUyxDQUFDLGtCQUFrQixFQUFFO1FBQ2hDLHlFQUF5RTtRQUN6RSw0RUFBNEU7UUFDNUUsYUFBYTtRQUNiLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ3pEO0lBRUQsd0VBQXdFO0lBQ3hFLG9EQUFvRDtJQUNwRCxLQUFLLE1BQU0sUUFBUSxJQUFJLGVBQWUsRUFBRTtRQUN0QyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3hDO0lBRUQsT0FBTyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLG9CQUFvQixDQUN6QixPQUFtQixFQUFFLEtBQWUsRUFBRSxRQUFrQixFQUFFLFFBQWdCLEVBQzFFLE1BQXVCO0lBQ3pCLE1BQU0sU0FBUyxHQUFHLElBQUksRUFBRSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDN0MsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsSUFBSSxVQUFVLEVBQUU7WUFDZCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ25ELElBQUksUUFBUSxFQUFFO2dCQUNaLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDcEQsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztnQkFDMUQsTUFBTSxPQUFPLEdBQUcscUJBQXFCLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN0QyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQzthQUN2RDtTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxTQUF1QixFQUFFLEVBQWlCO0lBQ3JFLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDbkMsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25FLENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLFFBQWdCO0lBQ2pELE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVELFNBQVMsOEJBQThCLENBQ25DLE9BQTJCLEVBQUUsU0FBdUIsRUFDcEQsU0FBcUI7SUFDdkIsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBRTNDLHdGQUF3RjtJQUN4RixJQUFJLGFBQWEsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDO0lBQzFDLElBQUksU0FBUyxZQUFZLEVBQUUsQ0FBQyxZQUFZLEVBQUU7UUFDeEMsYUFBYSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsQ0FBQztLQUN4RjtJQUNELE1BQU0sV0FBVyxHQUFvQyxFQUFFLENBQUM7SUFDeEQsbUVBQW1FO0lBQ25FLDhEQUE4RDtJQUM5RCxvRUFBb0U7SUFDcEUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7SUFDdkQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7SUFDdEQsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9GLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQzVDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQix5REFBeUQ7UUFDekQsK0JBQStCO1FBQy9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDM0Q7SUFFRCxJQUFJLFNBQVMsWUFBWSxFQUFFLENBQUMsWUFBWSxFQUFFO1FBQ3hDLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztLQUN0RDtJQUVELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1FBQ3ZCLGdFQUFnRTtRQUNoRSxzQkFBc0I7UUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7S0FDM0Q7SUFDRCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtJQUMzQixPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2hEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQge1BlcmZQaGFzZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9wZXJmJztcbmltcG9ydCB7QmF6ZWxPcHRpb25zLCBDYWNoZWRGaWxlTG9hZGVyLCBDb21waWxlckhvc3QsIGNvbnN0cnVjdE1hbmlmZXN0LCBkZWJ1ZywgRmlsZUNhY2hlLCBGaWxlTG9hZGVyLCBwYXJzZVRzY29uZmlnLCByZXNvbHZlTm9ybWFsaXplZFBhdGgsIHJ1bkFzV29ya2VyLCBydW5Xb3JrZXJMb29wLCBVbmNhY2hlZEZpbGVMb2FkZXJ9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5PbmVCdWlsZChhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogYm9vbGVhbiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSBhcmdzLnNoaWZ0KCk7XG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICBdKTtcblxuICBjb25zdCB1c2VyT3ZlcnJpZGVzID0gT2JqZWN0LmVudHJpZXModXNlck9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoW2tleV0pID0+IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcy5oYXMoa2V5KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVkdWNlKChvYmosIFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCB7fSk7XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBuZy5Bbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ10sXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVQYXRoOiBzdHJpbmcsIHJvb3REaXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmICghZmlsZVBhdGgpIHJldHVybiBmaWxlUGF0aDtcbiAgLy8gTkI6IHRoZSByb290RGlycyBzaG91bGQgaGF2ZSBiZWVuIHNvcnRlZCBsb25nZXN0LWZpcnN0XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcm9vdERpcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBkaXIgPSByb290RGlyc1tpXTtcbiAgICBjb25zdCByZWwgPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGRpciwgZmlsZVBhdGgpO1xuICAgIGlmIChyZWwuaW5kZXhPZignLicpICE9IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdFxufToge1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lPzogYm9vbGVhbiwgY29tcGlsZXJPcHRzOiBuZy5Db21waWxlck9wdGlvbnMsIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0LFxuICBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sXG4gICAgICAgIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICAgICAgICBmaWxlczogc3RyaW5nW10sXG4gICAgICAgIGV4cGVjdGVkT3V0czogc3RyaW5nW10sXG4gIGdhdGhlckRpYWdub3N0aWNzPzogKHByb2dyYW06IG5nLlByb2dyYW0pID0+IG5nLkRpYWdub3N0aWNzLFxuICBiYXplbEhvc3Q/OiBDb21waWxlckhvc3QsXG59KToge2RpYWdub3N0aWNzOiBuZy5EaWFnbm9zdGljcywgcHJvZ3JhbTogbmcuUHJvZ3JhbX0ge1xuICBsZXQgZmlsZUxvYWRlcjogRmlsZUxvYWRlcjtcblxuICBpZiAoYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBtYXhDYWNoZVNpemVCeXRlcyA9IGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAqICgxIDw8IDIwKTtcbiAgICBmaWxlQ2FjaGUuc2V0TWF4Q2FjaGVTaXplKG1heENhY2hlU2l6ZUJ5dGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlQ2FjaGUucmVzZXRNYXhDYWNoZVNpemUoKTtcbiAgfVxuXG4gIGlmIChpbnB1dHMpIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IENhY2hlZEZpbGVMb2FkZXIoZmlsZUNhY2hlKTtcbiAgICAvLyBSZXNvbHZlIHRoZSBpbnB1dHMgdG8gYWJzb2x1dGUgcGF0aHMgdG8gbWF0Y2ggVHlwZVNjcmlwdCBpbnRlcm5hbHNcbiAgICBjb25zdCByZXNvbHZlZElucHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMoaW5wdXRzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0S2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qga2V5ID0gaW5wdXRLZXlzW2ldO1xuICAgICAgcmVzb2x2ZWRJbnB1dHMuc2V0KHJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBVbmNhY2hlZEZpbGVMb2FkZXIoKTtcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gISFjb21waWxlck9wdHMuZW5hYmxlSXZ5O1xuICBpZiAoIWNvbXBpbGVyT3B0cy5yb290RGlycykge1xuICAgIHRocm93IG5ldyBFcnJvcigncm9vdERpcnMgaXMgbm90IHNldCEnKTtcbiAgfVxuICBjb25zdCBiYXplbEJpbiA9IGNvbXBpbGVyT3B0cy5yb290RGlycy5maW5kKHJvb3REaXIgPT4gQkFaRUxfQklOLnRlc3Qocm9vdERpcikpO1xuICBpZiAoIWJhemVsQmluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGJhemVsIGJpbiBpbiB0aGUgcm9vdERpcnM6ICR7Y29tcGlsZXJPcHRzLnJvb3REaXJzfWApO1xuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRPdXRzU2V0ID0gbmV3IFNldChleHBlY3RlZE91dHMubWFwKHAgPT4gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChwKSkpO1xuXG4gIGNvbnN0IG9yaWdpbmFsV3JpdGVGaWxlID0gdHNIb3N0LndyaXRlRmlsZS5iaW5kKHRzSG9zdCk7XG4gIHRzSG9zdC53cml0ZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLCBzb3VyY2VGaWxlcz86IHRzLlNvdXJjZUZpbGVbXSkgPT4ge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9XG4gICAgICAgICAgICByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtjb21waWxlck9wdHMucm9vdERpcl0pO1xuICAgICAgICBpZiAoZXhwZWN0ZWRPdXRzU2V0LmhhcyhyZWxhdGl2ZSkpIHtcbiAgICAgICAgICBleHBlY3RlZE91dHNTZXQuZGVsZXRlKHJlbGF0aXZlKTtcbiAgICAgICAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgY29udGVudCwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QgPSBPYmplY3QuY3JlYXRlKHRzSG9zdCk7XG4gIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIoXG4gICAgICBtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcsXG4gICAgICBjb21waWxlck9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyk6IHRzLlJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyB7XG4gICAgcmV0dXJuIHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICBtb2R1bGVOYW1lLCBjb250YWluaW5nRmlsZSwgY29tcGlsZXJPcHRpb25zLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0KTtcbiAgfVxuXG4gIGlmICghYmF6ZWxIb3N0KSB7XG4gICAgYmF6ZWxIb3N0ID0gbmV3IENvbXBpbGVySG9zdChcbiAgICAgICAgZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcik7XG4gIH1cblxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICAgIGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgLy8gVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2Ygc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nIGNoZWNrcyB3aGV0aGVyIGBmaWxlTmFtZWAgaXMgcGFydCBvZlxuICAgICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAgIC8vIHNoaW1zIGZvciBvcmlnaW5hbCAudHMgZmlsZXMgaW4gdGhlIHByb2dyYW0gc2hvdWxkIGJlIHRyZWF0ZWQgaWRlbnRpY2FsbHkuIFRodXMsIHN0cmlwIHRoZVxuICAgICAgLy8gJy5uZ2ZhY3RvcnknIG9yICcubmdzdW1tYXJ5JyBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBhd2F5IGJlZm9yZSBjYWxsaW5nIHRoZSBkZWxlZ2F0ZS5cbiAgICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICAgIH07XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0LCBkaXNhYmxlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybWluZyBpbiB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0LlxuICAvLyBUaGUgQW5ndWxhciBjb21waWxlcnMgaGF2ZSB0aGVpciBvd24gbG9naWMgZm9yIGRlY29yYXRvciBwcm9jZXNzaW5nIGFuZCB3ZSB3b3VsZG4ndFxuICAvLyB3YW50IHRzaWNrbGUgdG8gaW50ZXJmZXJlIHdpdGggdGhhdC5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlKSB7XG4gICAgaWYgKGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lID09PSAnZ29vZ2xlMycpIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IHRydWU7XG4gICAgICAvLyBFbmFibGUgdGhlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybSBpbiBnb29nbGUzIHdpdGggSXZ5IG1vZGUgZW5hYmxlZC4gVGhlIHRzaWNrbGVcbiAgICAgIC8vIGRlY29yYXRvciB0cmFuc2Zvcm1hdGlvbiBpcyBzdGlsbCBuZWVkZWQuIFRoaXMgbWlnaHQgYmUgYmVjYXVzZSBvZiBjdXN0b20gZGVjb3JhdG9yc1xuICAgICAgLy8gd2l0aCB0aGUgYEBBbm5vdGF0aW9uYCBKU0RvYyB0aGF0IHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0uXG4gICAgICAvLyBUT0RPOiBGaWd1cmUgb3V0IHdoeSB0aGlzIGlzIG5lZWRlZCBpbiBnMyBhbmQgaG93IHdlIGNhbiBpbXByb3ZlIHRoaXMuIEZXLTIyMjVcbiAgICAgIGlmIChpc0luSXZ5TW9kZSkge1xuICAgICAgICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIEFuZ3VsYXIgY29tcGlsZXIgb3B0aW9uIGlzIG5vdCByZXNwZWN0ZWQgYnkgZGVmYXVsdFxuICAvLyBhcyBuZ2Mtd3JhcHBlZCBoYW5kbGVzIHRzaWNrbGUgZW1pdCBvbiBpdHMgb3duLiBUaGlzIG1lYW5zIHRoYXQgd2UgbmVlZCB0byB1cGRhdGVcbiAgLy8gdGhlIHRzaWNrbGUgY29tcGlsZXIgaG9zdCBiYXNlZCBvbiB0aGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBmbGFnLlxuICBpZiAoY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSB7XG4gICAgYmF6ZWxIb3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlID0gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID1cbiAgICAgICAgcGF0aC5wb3NpeC5qb2luKGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCBmbGF0TW9kdWxlT3V0UGF0aCkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcblxuICAgIGlmICh0YXJnZXRXb3Jrc3BhY2UgJiZcbiAgICAgICAgZmlsZU5hbWUgPT09XG4gICAgICAgICAgICBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjYWNoZUtleSA9IGAke2ltcG9ydGVkRmlsZVBhdGh9OiR7Y29udGFpbmluZ0ZpbGVQYXRofWA7XG4gICAgLy8gTWVtb2l6ZSB0aGlzIGxvb2t1cCB0byBhdm9pZCBleHBlbnNpdmUgcmUtcGFyc2VzIG9mIHRoZSBzYW1lIGZpbGVcbiAgICAvLyBXaGVuIHJ1biBhcyBhIHdvcmtlciwgdGhlIGFjdHVhbCB0cy5Tb3VyY2VGaWxlIGlzIGNhY2hlZFxuICAgIC8vIGJ1dCB3aGVuIHdlIGRvbid0IHJ1biBhcyBhIHdvcmtlciwgdGhlcmUgaXMgbm8gY2FjaGUuXG4gICAgLy8gRm9yIG9uZSBleGFtcGxlIHRhcmdldCBpbiBnMywgd2Ugc2F3IGEgY2FjaGUgaGl0IHJhdGUgb2YgNzU5MC83Njk1XG4gICAgaWYgKGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoLCBjb250YWluaW5nRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGNhY2hlS2V5LCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVsYXRpdmVUYXJnZXRQYXRoID1cbiAgICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGltcG9ydGVkRmlsZVBhdGgsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKTtcbiAgICBjb25zdCBtYW5pZmVzdFRhcmdldFBhdGggPSBgJHtiYXplbE9wdHMud29ya3NwYWNlTmFtZX0vJHtyZWxhdGl2ZVRhcmdldFBhdGh9YDtcbiAgICBpZiAodXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG5cbiAgICAvLyBVbmxlc3MgbWFuaWZlc3QgcGF0aHMgYXJlIGV4cGxpY2l0bHkgZW5mb3JjZWQsIHdlIGluaXRpYWxseSBjaGVjayBpZiBhIG1vZHVsZSBuYW1lIGlzXG4gICAgLy8gc2V0IGZvciB0aGUgZ2l2ZW4gc291cmNlIGZpbGUuIFRoZSBjb21waWxlciBob3N0IGZyb20gYEBiYXplbC90eXBlc2NyaXB0YCBzZXRzIHNvdXJjZVxuICAgIC8vIGZpbGUgbW9kdWxlIG5hbWVzIGlmIHRoZSBjb21waWxhdGlvbiB0YXJnZXRzIGVpdGhlciBVTUQgb3IgQU1ELiBUbyBlbnN1cmUgdGhhdCB0aGUgQU1EXG4gICAgLy8gbW9kdWxlIG5hbWVzIG1hdGNoLCB3ZSBmaXJzdCBjb25zaWRlciB0aG9zZS5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IG5nSG9zdC5nZXRTb3VyY2VGaWxlKGltcG9ydGVkRmlsZVBhdGgsIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QpO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgJiYgc291cmNlRmlsZS5tb2R1bGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlLm1vZHVsZU5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIHBhcnNlIGVycm9yLiBJZ25vcmUgdGhpcyBjYXNlIGFuZCBjb250aW51ZSBvbnRvIHRoZVxuICAgICAgLy8gb3RoZXIgbWV0aG9kcyBvZiByZXNvbHZpbmcgdGhlIG1vZHVsZSBiZWxvdy5cbiAgICB9XG5cbiAgICAvLyBJdCBjYW4gaGFwcGVuIHRoYXQgdGhlIFZpZXdFbmdpbmUgY29tcGlsZXIgbmVlZHMgdG8gd3JpdGUgYW4gaW1wb3J0IGluIGEgZmFjdG9yeSBmaWxlLFxuICAgIC8vIGFuZCBpcyB1c2luZyBhbiBuZ3N1bW1hcnkgZmlsZSB0byBnZXQgdGhlIHN5bWJvbHMuXG4gICAgLy8gVGhlIG5nc3VtbWFyeSBjb21lcyBmcm9tIGFuIHVwc3RyZWFtIG5nX21vZHVsZSBydWxlLlxuICAgIC8vIFRoZSB1cHN0cmVhbSBydWxlIGJhc2VkIGl0cyBpbXBvcnRzIG9uIG5nc3VtbWFyeSBmaWxlIHdoaWNoIHdhcyBnZW5lcmF0ZWQgZnJvbSBhXG4gICAgLy8gbWV0YWRhdGEuanNvbiBmaWxlIHRoYXQgd2FzIHB1Ymxpc2hlZCB0byBucG0gaW4gYW4gQW5ndWxhciBsaWJyYXJ5LlxuICAgIC8vIEhvd2V2ZXIsIHRoZSBuZ3N1bW1hcnkgZG9lc24ndCBwcm9wYWdhdGUgdGhlICdpbXBvcnRBcycgZnJvbSB0aGUgb3JpZ2luYWwgbWV0YWRhdGEuanNvblxuICAgIC8vIHNvIHdlIHdvdWxkIG5vcm1hbGx5IG5vdCBiZSBhYmxlIHRvIHN1cHBseSB0aGUgY29ycmVjdCBtb2R1bGUgbmFtZSBmb3IgaXQuXG4gICAgLy8gRm9yIGV4YW1wbGUsIGlmIHRoZSByb290RGlyLXJlbGF0aXZlIGZpbGVQYXRoIGlzXG4gICAgLy8gIG5vZGVfbW9kdWxlcy9AYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyB3ZSB3b3VsZCBzdXBwbHkgYSBtb2R1bGUgbmFtZVxuICAgIC8vICBAYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyBidXQgdGhlcmUgaXMgbm8gSmF2YVNjcmlwdCBmaWxlIHRvIGxvYWQgYXQgdGhpcyBwYXRoLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy8yOTQ1NFxuICAgIGlmIChpbXBvcnRlZEZpbGVQYXRoLmluZGV4T2YoJ25vZGVfbW9kdWxlcycpID49IDApIHtcbiAgICAgIGNvbnN0IG1heWJlTWV0YWRhdGFGaWxlID0gaW1wb3J0ZWRGaWxlUGF0aC5yZXBsYWNlKEVYVCwgJycpICsgJy5tZXRhZGF0YS5qc29uJztcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKG1heWJlTWV0YWRhdGFGaWxlKSkge1xuICAgICAgICBjb25zdCBtb2R1bGVOYW1lID0gKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG1heWJlTWV0YWRhdGFGaWxlLCB7ZW5jb2Rpbmc6ICd1dGYtOCd9KSkgYXMge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbXBvcnRBczogc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5pbXBvcnRBcztcbiAgICAgICAgaWYgKG1vZHVsZU5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gbW9kdWxlTmFtZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5VTUQgfHwgY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5BTUQpICYmXG4gICAgICAgIG5nSG9zdC5hbWRNb2R1bGVOYW1lKSB7XG4gICAgICByZXR1cm4gbmdIb3N0LmFtZE1vZHVsZU5hbWUoe2ZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRofSBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgICB9XG5cbiAgICAvLyBJZiBubyBBTUQgbW9kdWxlIG5hbWUgaGFzIGJlZW4gc2V0IGZvciB0aGUgc291cmNlIGZpbGUgYnkgdGhlIGBAYmF6ZWwvdHlwZXNjcmlwdGAgY29tcGlsZXJcbiAgICAvLyBob3N0LCBhbmQgdGhlIHRhcmdldCBmaWxlIGlzIG5vdCBwYXJ0IG9mIGEgZmxhdCBtb2R1bGUgbm9kZSBtb2R1bGUgcGFja2FnZSwgd2UgdXNlIHRoZVxuICAgIC8vIGZvbGxvd2luZyBydWxlcyAoaW4gb3JkZXIpOlxuICAgIC8vICAgIDEuIElmIHRhcmdldCBmaWxlIGlzIHBhcnQgb2YgYG5vZGVfbW9kdWxlcy9gLCB3ZSB1c2UgdGhlIHBhY2thZ2UgbW9kdWxlIG5hbWUuXG4gICAgLy8gICAgMi4gSWYgbm8gY29udGFpbmluZyBmaWxlIGlzIHNwZWNpZmllZCwgb3IgdGhlIHRhcmdldCBmaWxlIGlzIHBhcnQgb2YgYSBkaWZmZXJlbnRcbiAgICAvLyAgICAgICBjb21waWxhdGlvbiB1bml0LCB3ZSB1c2UgYSBCYXplbCBtYW5pZmVzdCBwYXRoLiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IHBvc3NpYmxlXG4gICAgLy8gICAgICAgc2luY2Ugd2UgZG9uJ3QgaGF2ZSBhIGNvbnRhaW5pbmcgZmlsZSwgYW5kIHRoZSB0YXJnZXQgZmlsZSBjb3VsZCBiZSBsb2NhdGVkIGluIHRoZVxuICAgIC8vICAgICAgIG91dHB1dCBkaXJlY3RvcnksIG9yIGluIGFuIGV4dGVybmFsIEJhemVsIHJlcG9zaXRvcnkuXG4gICAgLy8gICAgMy4gSWYgYm90aCBydWxlcyBhYm92ZSBkaWRuJ3QgbWF0Y2gsIHdlIGNvbXB1dGUgYSByZWxhdGl2ZSBwYXRoIGJldHdlZW4gdGhlIHNvdXJjZSBmaWxlc1xuICAgIC8vICAgICAgIHNpbmNlIHRoZXkgYXJlIHBhcnQgb2YgdGhlIHNhbWUgY29tcGlsYXRpb24gdW5pdC5cbiAgICAvLyBOb3RlIHRoYXQgd2UgZG9uJ3Qgd2FudCB0byBhbHdheXMgdXNlICgyKSBiZWNhdXNlIGl0IGNvdWxkIG1lYW4gdGhhdCBjb21waWxhdGlvbiBvdXRwdXRzXG4gICAgLy8gYXJlIGFsd2F5cyBsZWFraW5nIEJhemVsLXNwZWNpZmljIHBhdGhzLCBhbmQgdGhlIG91dHB1dCBpcyBub3Qgc2VsZi1jb250YWluZWQuIFRoaXMgY291bGRcbiAgICAvLyBicmVhayBgZXNtMjAxNWAgb3IgYGVzbTVgIG91dHB1dCBmb3IgQW5ndWxhciBwYWNrYWdlIHJlbGVhc2Ugb3V0cHV0XG4gICAgLy8gT21pdCB0aGUgYG5vZGVfbW9kdWxlc2AgcHJlZml4IGlmIHRoZSBtb2R1bGUgbmFtZSBvZiBhbiBOUE0gcGFja2FnZSBpcyByZXF1ZXN0ZWQuXG4gICAgaWYgKHJlbGF0aXZlVGFyZ2V0UGF0aC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZWxhdGl2ZVRhcmdldFBhdGguc3Vic3RyKE5PREVfTU9EVUxFUy5sZW5ndGgpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGNvbnRhaW5pbmdGaWxlUGF0aCA9PSBudWxsIHx8ICFiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5jbHVkZXMoaW1wb3J0ZWRGaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiBtYW5pZmVzdFRhcmdldFBhdGg7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRhaW5pbmdGaWxlRGlyID1cbiAgICAgICAgcGF0aC5kaXJuYW1lKHJlbGF0aXZlVG9Sb290RGlycyhjb250YWluaW5nRmlsZVBhdGgsIGNvbXBpbGVyT3B0cy5yb290RGlycykpO1xuICAgIGNvbnN0IHJlbGF0aXZlSW1wb3J0UGF0aCA9IHBhdGgucG9zaXgucmVsYXRpdmUoY29udGFpbmluZ0ZpbGVEaXIsIHJlbGF0aXZlVGFyZ2V0UGF0aCk7XG4gICAgcmV0dXJuIHJlbGF0aXZlSW1wb3J0UGF0aC5zdGFydHNXaXRoKCcuJykgPyByZWxhdGl2ZUltcG9ydFBhdGggOiBgLi8ke3JlbGF0aXZlSW1wb3J0UGF0aH1gO1xuICB9XG5cbiAgbmdIb3N0LnRvU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpID0+IHBhdGgucG9zaXguam9pbihcbiAgICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLFxuICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVOYW1lLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJykpO1xuICBpZiAoYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsKSB7XG4gICAgLy8gTm90ZTogVGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gd291bGQgd29yayBhcyB3ZWxsLFxuICAgIC8vIGJ1dCB3ZSBjYW4gYmUgZmFzdGVyIGFzIHdlIGtub3cgaG93IGB0b1N1bW1hcnlGaWxlTmFtZWAgd29ya3MuXG4gICAgLy8gTm90ZTogV2UgY2FuJ3QgZG8gdGhpcyBpZiBzb21lIGRlcHMgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggdGhlIGNvbW1hbmQgbGluZSxcbiAgICAvLyBhcyB0aGF0IGhhcyBhIGRpZmZlcmVudCBpbXBsZW1lbnRhdGlvbiBvZiBmcm9tU3VtbWFyeUZpbGVOYW1lIC8gdG9TdW1tYXJ5RmlsZU5hbWVcbiAgICBuZ0hvc3QuZnJvbVN1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdMaWJGaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSZWxhdGl2ZSA9IGZpbGVOYW1lLnNwbGl0KCcvJykuc3BsaWNlKDEpLmpvaW4oJy8nKTtcbiAgICAgIHJldHVybiByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHdvcmtzcGFjZVJlbGF0aXZlKSArICcuZC50cyc7XG4gICAgfTtcbiAgfVxuICAvLyBQYXRjaCBhIHByb3BlcnR5IG9uIHRoZSBuZ0hvc3QgdGhhdCBhbGxvd3MgdGhlIHJlc291cmNlTmFtZVRvTW9kdWxlTmFtZSBmdW5jdGlvbiB0b1xuICAvLyByZXBvcnQgYmV0dGVyIGVycm9ycy5cbiAgKG5nSG9zdCBhcyBhbnkpLnJlcG9ydE1pc3NpbmdSZXNvdXJjZSA9IChyZXNvdXJjZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxcbkFzc2V0IG5vdCBmb3VuZDpcXG4gICR7cmVzb3VyY2VOYW1lfWApO1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoZWNrIHRoYXQgaXRcXCdzIGluY2x1ZGVkIGluIHRoZSBgYXNzZXRzYCBhdHRyaWJ1dGUgb2YgdGhlIGBuZ19tb2R1bGVgIHJ1bGUuXFxuJyk7XG4gIH07XG5cbiAgY29uc3QgZW1pdENhbGxiYWNrOiBuZy5Uc0VtaXRDYWxsYmFjayA9ICh7XG4gICAgcHJvZ3JhbSxcbiAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgIHdyaXRlRmlsZSxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICB9KSA9PlxuICAgICAgdHNpY2tsZS5lbWl0V2l0aFRzaWNrbGUoXG4gICAgICAgICAgcHJvZ3JhbSwgYmF6ZWxIb3N0LCBiYXplbEhvc3QsIGNvbXBpbGVyT3B0cywgdGFyZ2V0U291cmNlRmlsZSwgd3JpdGVGaWxlLFxuICAgICAgICAgIGNhbmNlbGxhdGlvblRva2VuLCBlbWl0T25seUR0c0ZpbGVzLCB7XG4gICAgICAgICAgICBiZWZvcmVUczogY3VzdG9tVHJhbnNmb3JtZXJzLmJlZm9yZSxcbiAgICAgICAgICAgIGFmdGVyVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlcixcbiAgICAgICAgICAgIGFmdGVyRGVjbGFyYXRpb25zOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXJEZWNsYXJhdGlvbnMsXG4gICAgICAgICAgfSk7XG5cbiAgaWYgKCFnYXRoZXJEaWFnbm9zdGljcykge1xuICAgIGdhdGhlckRpYWdub3N0aWNzID0gKHByb2dyYW0pID0+XG4gICAgICAgIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShjb21waWxlck9wdHMsIGJhemVsT3B0cywgcHJvZ3JhbSk7XG4gIH1cbiAgY29uc3Qge2RpYWdub3N0aWNzLCBlbWl0UmVzdWx0LCBwcm9ncmFtfSA9IG5nLnBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgcm9vdE5hbWVzOiBmaWxlcyxcbiAgICBvcHRpb25zOiBjb21waWxlck9wdHMsXG4gICAgaG9zdDogbmdIb3N0LFxuICAgIGVtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s6IHRzaWNrbGUubWVyZ2VFbWl0UmVzdWx0cyxcbiAgICBnYXRoZXJEaWFnbm9zdGljc1xuICB9KTtcbiAgY29uc3QgdHNpY2tsZUVtaXRSZXN1bHQgPSBlbWl0UmVzdWx0IGFzIHRzaWNrbGUuRW1pdFJlc3VsdDtcbiAgbGV0IGV4dGVybnMgPSAnLyoqIEBleHRlcm5zICovXFxuJztcbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVHZW5lcmF0ZUV4dGVybnMpIHtcbiAgICAgIGV4dGVybnMgKz0gdHNpY2tsZS5nZXRHZW5lcmF0ZWRFeHRlcm5zKHRzaWNrbGVFbWl0UmVzdWx0LmV4dGVybnMpO1xuICAgIH1cbiAgICBpZiAoYmF6ZWxPcHRzLm1hbmlmZXN0KSB7XG4gICAgICBjb25zdCBtYW5pZmVzdCA9IGNvbnN0cnVjdE1hbmlmZXN0KHRzaWNrbGVFbWl0UmVzdWx0Lm1vZHVsZXNNYW5pZmVzdCwgYmF6ZWxIb3N0KTtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLm1hbmlmZXN0LCBtYW5pZmVzdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgY29tcGlsYXRpb24gZmFpbHMgdW5leHBlY3RlZGx5LCBwZXJmb3JtQ29tcGlsYXRpb24gcmV0dXJucyBubyBwcm9ncmFtLlxuICAvLyBNYWtlIHN1cmUgbm90IHRvIGNyYXNoIGJ1dCByZXBvcnQgdGhlIGRpYWdub3N0aWNzLlxuICBpZiAoIXByb2dyYW0pIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xuXG4gIGlmICghYmF6ZWxPcHRzLm5vZGVNb2R1bGVzUHJlZml4KSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gbm9kZSBtb2R1bGVzLCB0aGVuIG1ldGFkYXRhLmpzb24gc2hvdWxkIGJlIGVtaXR0ZWQgc2luY2VcbiAgICAvLyB0aGVyZSBpcyBubyBvdGhlciB3YXkgdG8gb2J0YWluIHRoZSBpbmZvcm1hdGlvblxuICAgIGdlbmVyYXRlTWV0YWRhdGFKc29uKHByb2dyYW0uZ2V0VHNQcm9ncmFtKCksIGZpbGVzLCBjb21waWxlck9wdHMucm9vdERpcnMsIGJhemVsQmluLCB0c0hvc3QpO1xuICB9XG5cbiAgaWYgKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgpIHtcbiAgICAvLyBOb3RlOiB3aGVuIHRzaWNrbGVFeHRlcm5zUGF0aCBpcyBwcm92aWRlZCwgd2UgYWx3YXlzIHdyaXRlIGEgZmlsZSBhcyBhXG4gICAgLy8gbWFya2VyIHRoYXQgY29tcGlsYXRpb24gc3VjY2VlZGVkLCBldmVuIGlmIGl0J3MgZW1wdHkgKGp1c3QgY29udGFpbmluZyBhblxuICAgIC8vIEBleHRlcm5zKS5cbiAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgsIGV4dGVybnMpO1xuICB9XG5cbiAgLy8gVGhlcmUgbWlnaHQgYmUgc29tZSBleHBlY3RlZCBvdXRwdXQgZmlsZXMgdGhhdCBhcmUgbm90IHdyaXR0ZW4gYnkgdGhlXG4gIC8vIGNvbXBpbGVyLiBJbiB0aGlzIGNhc2UsIGp1c3Qgd3JpdGUgYW4gZW1wdHkgZmlsZS5cbiAgZm9yIChjb25zdCBmaWxlTmFtZSBvZiBleHBlY3RlZE91dHNTZXQpIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgJycsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIG1ldGFkYXRhLmpzb24gZm9yIHRoZSBzcGVjaWZpZWQgYGZpbGVzYC4gQnkgZGVmYXVsdCwgbWV0YWRhdGEuanNvblxuICogaXMgb25seSBnZW5lcmF0ZWQgYnkgdGhlIGNvbXBpbGVyIGlmIC0tZmxhdE1vZHVsZU91dEZpbGUgaXMgc3BlY2lmaWVkLiBCdXRcbiAqIGlmIGNvbXBpbGVkIHVuZGVyIGJsYXplLCB3ZSB3YW50IHRoZSBtZXRhZGF0YSB0byBiZSBnZW5lcmF0ZWQgZm9yIGVhY2hcbiAqIEFuZ3VsYXIgY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZU1ldGFkYXRhSnNvbihcbiAgICBwcm9ncmFtOiB0cy5Qcm9ncmFtLCBmaWxlczogc3RyaW5nW10sIHJvb3REaXJzOiBzdHJpbmdbXSwgYmF6ZWxCaW46IHN0cmluZyxcbiAgICB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCkge1xuICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgbmcuTWV0YWRhdGFDb2xsZWN0b3IoKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpXTtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgIGlmIChzb3VyY2VGaWxlKSB7XG4gICAgICBjb25zdCBtZXRhZGF0YSA9IGNvbGxlY3Rvci5nZXRNZXRhZGF0YShzb3VyY2VGaWxlKTtcbiAgICAgIGlmIChtZXRhZGF0YSkge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9IHJlbGF0aXZlVG9Sb290RGlycyhmaWxlLCByb290RGlycyk7XG4gICAgICAgIGNvbnN0IHNob3J0UGF0aCA9IHJlbGF0aXZlLnJlcGxhY2UoRVhULCAnLm1ldGFkYXRhLmpzb24nKTtcbiAgICAgICAgY29uc3Qgb3V0RmlsZSA9IHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgc2hvcnRQYXRoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KG1ldGFkYXRhKTtcbiAgICAgICAgdHNIb3N0LndyaXRlRmlsZShvdXRGaWxlLCBkYXRhLCBmYWxzZSwgdW5kZWZpbmVkLCBbXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsIHNmOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhTkdDX0dFTl9GSUxFUy50ZXN0KHNmLmZpbGVOYW1lKSAmJlxuICAgICAgKGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmRleE9mKHNmLmZpbGVOYW1lKSAhPT0gLTEpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZmlsZVBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xufVxuXG5mdW5jdGlvbiBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoXG4gICAgb3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICBuZ1Byb2dyYW06IG5nLlByb2dyYW0pOiAobmcuRGlhZ25vc3RpY3x0cy5EaWFnbm9zdGljKVtdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gIC8vIEZvciB0aGUgSXZ5IGNvbXBpbGVyLCB0cmFjayB0aGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgZmV0Y2hpbmcgVHlwZVNjcmlwdCBkaWFnbm9zdGljcy5cbiAgbGV0IHByZXZpb3VzUGhhc2UgPSBQZXJmUGhhc2UuVW5hY2NvdW50ZWQ7XG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBwcmV2aW91c1BoYXNlID0gbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShQZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzKTtcbiAgfVxuICBjb25zdCBkaWFnbm9zdGljczogKG5nLkRpYWdub3N0aWN8dHMuRGlhZ25vc3RpYylbXSA9IFtdO1xuICAvLyBUaGVzZSBjaGVja3MgbWlycm9yIHRzLmdldFByZUVtaXREaWFnbm9zdGljcywgd2l0aCB0aGUgaW1wb3J0YW50XG4gIC8vIGV4Y2VwdGlvbiBvZiBhdm9pZGluZyBiLzMwNzA4MjQwLCB3aGljaCBpcyB0aGF0IGlmIHlvdSBjYWxsXG4gIC8vIHByb2dyYW0uZ2V0RGVjbGFyYXRpb25EaWFnbm9zdGljcygpIGl0IHNvbWVob3cgY29ycnVwdHMgdGhlIGVtaXQuXG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpKTtcbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKSk7XG4gIGNvbnN0IHByb2dyYW1GaWxlcyA9IHRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihmID0+IGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzLCBmKSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvZ3JhbUZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgc2YgPSBwcm9ncmFtRmlsZXNbaV07XG4gICAgLy8gTm90ZTogV2Ugb25seSBnZXQgdGhlIGRpYWdub3N0aWNzIGZvciBpbmRpdmlkdWFsIGZpbGVzXG4gICAgLy8gdG8gZS5nLiBub3QgY2hlY2sgbGlicmFyaWVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNmKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzZikpO1xuICB9XG5cbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UocHJldmlvdXNQaGFzZSk7XG4gIH1cblxuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIC8vIG9ubHkgZ2F0aGVyIHRoZSBhbmd1bGFyIGRpYWdub3N0aWNzIGlmIHdlIGhhdmUgbm8gZGlhZ25vc3RpY3NcbiAgICAvLyBpbiBhbnkgb3RoZXIgZmlsZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIHByb2Nlc3MuZXhpdENvZGUgPSBtYWluKHByb2Nlc3MuYXJndi5zbGljZSgyKSk7XG59XG4iXX0=