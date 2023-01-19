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
import { EXT, patchNgHostWithFileNameToModuleName as patchNgHost, relativeToRootDirs } from './utils';
const NGC_GEN_FILES = /^(.*?)\.(ngfactory|ngsummary|ngstyle|shim\.ngstyle)(.*)$/;
// FIXME: we should be able to add the assets to the tsconfig so FileLoader
// knows about them
const NGC_ASSETS = /\.(css|html|ngsummary\.json)$/;
const BAZEL_BIN = /\b(blaze|bazel)-out\b.*?\bbin\b/;
// Note: We compile the content of node_modules with plain ngc command line.
const ALL_DEPS_COMPILED_WITH_BAZEL = false;
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
    // Never run the tsickle decorator transform.
    // TODO(b/254054103): Remove the transform and this flag.
    bazelHost.transformDecorators = false;
    // By default in the `prodmode` output, we do not add annotations for closure compiler.
    // Though, if we are building inside `google3`, closure annotations are desired for
    // prodmode output, so we enable it by default. The defaults can be overridden by
    // setting the `annotateForClosureCompiler` compiler option in the user tsconfig.
    if (!bazelOpts.es5Mode && !bazelOpts.devmode) {
        if (bazelOpts.workspaceName === 'google3') {
            compilerOpts.annotateForClosureCompiler = true;
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
    patchNgHost(ngHost, compilerOpts, rootDirs, bazelOpts.workspaceName, bazelOpts.compilationTargetSrc, !!useManifestPathsAsModuleName);
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
 * @deprecated
 * Kept here just for compatibility with 1P tools. To be removed soon after 1P update.
 */
export function patchNgHostWithFileNameToModuleName(ngHost, compilerOpts, bazelOpts, rootDirs, useManifestPathsAsModuleName) {
    patchNgHost(ngHost, compilerOpts, rootDirs, bazelOpts.workspaceName, bazelOpts.compilationTargetSrc, useManifestPathsAsModuleName);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0ZBQXNGO0FBQ3RGLE9BQU8sS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sSUFBSSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sS0FBSyxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBQ25DLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUU1QixPQUFPLEVBQUMsR0FBRyxFQUFFLG1DQUFtQyxJQUFJLFdBQVcsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVFwRyxNQUFNLGFBQWEsR0FBRywwREFBMEQsQ0FBQztBQUNqRiwyRUFBMkU7QUFDM0UsbUJBQW1CO0FBQ25CLE1BQU0sVUFBVSxHQUFHLCtCQUErQixDQUFDO0FBRW5ELE1BQU0sU0FBUyxHQUFHLGlDQUFpQyxDQUFDO0FBRXBELDRFQUE0RTtBQUM1RSxNQUFNLDRCQUE0QixHQUFHLEtBQUssQ0FBQztBQUUzQyxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBQyxJQUFjO0lBQ3ZDLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUMxQixNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDdkM7U0FBTTtRQUNMLE9BQU8sTUFBTSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3hD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IFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vIGB0c2Mtd3JhcHBlZGAgaGVscGVycyBhcmUgbm90IGV4cG9zZWQgaW4gdGhlIHByaW1hcnkgYEBiYXplbC9jb25jYXRqc2AgZW50cnktcG9pbnQuXG5pbXBvcnQgKiBhcyBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtQZXJmUGhhc2V9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9wcml2YXRlL2JhemVsJztcbmltcG9ydCB0c2N3IGZyb20gJ0BiYXplbC9jb25jYXRqcy9pbnRlcm5hbC90c2Nfd3JhcHBlZC9pbmRleC5qcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHNpY2tsZSBmcm9tICd0c2lja2xlJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFWFQsIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lIGFzIHBhdGNoTmdIb3N0LCByZWxhdGl2ZVRvUm9vdERpcnN9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBBZGQgZGV2bW9kZSBmb3IgYmxhemUgaW50ZXJuYWxcbmludGVyZmFjZSBCYXplbE9wdGlvbnMgZXh0ZW5kcyB0c2N3LkJhemVsT3B0aW9ucyB7XG4gIGFsbG93ZWRJbnB1dHM/OiBzdHJpbmdbXTtcbiAgdW51c2VkSW5wdXRzTGlzdFBhdGg/OiBzdHJpbmc7XG59XG5cbmNvbnN0IE5HQ19HRU5fRklMRVMgPSAvXiguKj8pXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnl8bmdzdHlsZXxzaGltXFwubmdzdHlsZSkoLiopJC87XG4vLyBGSVhNRTogd2Ugc2hvdWxkIGJlIGFibGUgdG8gYWRkIHRoZSBhc3NldHMgdG8gdGhlIHRzY29uZmlnIHNvIEZpbGVMb2FkZXJcbi8vIGtub3dzIGFib3V0IHRoZW1cbmNvbnN0IE5HQ19BU1NFVFMgPSAvXFwuKGNzc3xodG1sfG5nc3VtbWFyeVxcLmpzb24pJC87XG5cbmNvbnN0IEJBWkVMX0JJTiA9IC9cXGIoYmxhemV8YmF6ZWwpLW91dFxcYi4qP1xcYmJpblxcYi87XG5cbi8vIE5vdGU6IFdlIGNvbXBpbGUgdGhlIGNvbnRlbnQgb2Ygbm9kZV9tb2R1bGVzIHdpdGggcGxhaW4gbmdjIGNvbW1hbmQgbGluZS5cbmNvbnN0IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwgPSBmYWxzZTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJnczogc3RyaW5nW10pIHtcbiAgaWYgKHRzY3cucnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCB0c2N3LnJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhd2FpdCBydW5PbmVCdWlsZChhcmdzKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgdHNjdy5GaWxlQ2FjaGU8dHMuU291cmNlRmlsZT4odHNjdy5kZWJ1Zyk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChcbiAgICBhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSB7XG4gICAgYXJncy5zaGlmdCgpO1xuICB9XG5cbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHRzY3cucGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHBhcnNlZE9wdGlvbnMgPT09IG51bGwpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgcGFyc2UgdHNjb25maWcuIE5vIHBhcnNlIGRpYWdub3N0aWNzIHByb3ZpZGVkLicpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICAgICdleHRlbmRlZERpYWdub3N0aWNzJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwge30gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuXG4gIC8vIEFuZ3VsYXIgQ29tcGlsZXIgb3B0aW9ucyBhcmUgYWx3YXlzIHNldCB1bmRlciBCYXplbC4gU2VlIGBuZ19tb2R1bGUuYnpsYC5cbiAgY29uc3QgYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMgPVxuICAgICAgKGNvbmZpZyBhcyB7YW5ndWxhckNvbXBpbGVyT3B0aW9uczogbmcuQW5ndWxhckNvbXBpbGVyT3B0aW9uc30pWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ107XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBuZy5Bbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMsXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGFuZ3VsYXJDb25maWdSYXdPcHRpb25zO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdCxcbn06IHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsPzogYm9vbGVhbixcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZT86IGJvb2xlYW4sIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLCB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCxcbiAgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICAgICAgZmlsZXM6IHN0cmluZ1tdLFxuICAgICAgICBleHBlY3RlZE91dHM6IHN0cmluZ1tdLFxuICBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiByZWFkb25seSB0cy5EaWFnbm9zdGljW10sXG4gIGJhemVsSG9zdD86IHRzY3cuQ29tcGlsZXJIb3N0LFxufSk6IHtkaWFnbm9zdGljczogcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfHVuZGVmaW5lZH0ge1xuICBsZXQgZmlsZUxvYWRlcjogdHNjdy5GaWxlTG9hZGVyO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHNldCBpbiBCYXplbC4gU2VlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9ydWxlc19ub2RlanMvYmxvYi81OTFlNzZlZGM5ZWUwYTcxZDYwNGM1OTk5YWY4YmFkNzkwOWVmMmQ0L3BhY2thZ2VzL2NvbmNhdGpzL2ludGVybmFsL2NvbW1vbi90c2NvbmZpZy5iemwjTDI0Ni5cbiAgY29uc3QgYmFzZVVybCA9IGNvbXBpbGVyT3B0cy5iYXNlVXJsITtcbiAgY29uc3Qgcm9vdERpciA9IGNvbXBpbGVyT3B0cy5yb290RGlyITtcbiAgY29uc3Qgcm9vdERpcnMgPSBjb21waWxlck9wdHMucm9vdERpcnMhO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgdHNjdy5DYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzLnNldCh0c2N3LnJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyB0c2N3LlVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IGZyb20gY29tcGlsZXJPcHRzIHdoZXRoZXIgdGhlIGVudHJ5cG9pbnQgaXMgYmVpbmcgaW52b2tlZCBpbiBJdnkgbW9kZS5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0c1NldCA9IG5ldyBTZXQoZXhwZWN0ZWRPdXRzLm1hcChwID0+IGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgocCkpKTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiByZWFkb25seSB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtyb290RGlyXSk7XG4gICAgICAgIGlmIChleHBlY3RlZE91dHNTZXQuaGFzKHJlbGF0aXZlKSkge1xuICAgICAgICAgIGV4cGVjdGVkT3V0c1NldC5kZWxldGUocmVsYXRpdmUpO1xuICAgICAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICBpZiAoIWJhemVsSG9zdCkge1xuICAgIGJhemVsSG9zdCA9IG5ldyB0c2N3LkNvbXBpbGVySG9zdChmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlcik7XG4gIH1cblxuICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAvLyBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBzaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgY2hlY2tzIHdoZXRoZXIgYGZpbGVOYW1lYCBpcyBwYXJ0IG9mXG4gICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAvLyBzaGltcyBmb3Igb3JpZ2luYWwgLnRzIGZpbGVzIGluIHRoZSBwcm9ncmFtIHNob3VsZCBiZSB0cmVhdGVkIGlkZW50aWNhbGx5LiBUaHVzLCBzdHJpcCB0aGVcbiAgICAvLyAnLm5nZmFjdG9yeScgb3IgJy5uZ3N1bW1hcnknIHBhcnQgb2YgdGhlIGZpbGVuYW1lIGF3YXkgYmVmb3JlIGNhbGxpbmcgdGhlIGRlbGVnYXRlLlxuICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICB9O1xuXG4gIC8vIE5ldmVyIHJ1biB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtLlxuICAvLyBUT0RPKGIvMjU0MDU0MTAzKTogUmVtb3ZlIHRoZSB0cmFuc2Zvcm0gYW5kIHRoaXMgZmxhZy5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlICYmICFiYXplbE9wdHMuZGV2bW9kZSkge1xuICAgIGlmIChiYXplbE9wdHMud29ya3NwYWNlTmFtZSA9PT0gJ2dvb2dsZTMnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBBbmd1bGFyIGNvbXBpbGVyIG9wdGlvbiBpcyBub3QgcmVzcGVjdGVkIGJ5IGRlZmF1bHRcbiAgLy8gYXMgbmdjLXdyYXBwZWQgaGFuZGxlcyB0c2lja2xlIGVtaXQgb24gaXRzIG93bi4gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gdXBkYXRlXG4gIC8vIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QgYmFzZWQgb24gdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgZmxhZy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gIH1cblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3Qgb3JpZ0JhemVsSG9zdEZpbGVFeGlzdCA9IGJhemVsSG9zdC5maWxlRXhpc3RzO1xuICBiYXplbEhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKE5HQ19BU1NFVFMudGVzdChmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0LmNhbGwoYmF6ZWxIb3N0LCBmaWxlTmFtZSk7XG4gIH07XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlID0gYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZmxhdE1vZHVsZU91dFBhdGggPVxuICAgICAgICBwYXRoLnBvc2l4LmpvaW4oYmF6ZWxPcHRzLnBhY2thZ2UsIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnKTtcblxuICAgIC8vIFRoZSBidW5kbGUgaW5kZXggZmlsZSBpcyBzeW50aGVzaXplZCBpbiBidW5kbGVfaW5kZXhfaG9zdCBzbyBpdCdzIG5vdCBpbiB0aGVcbiAgICAvLyBjb21waWxhdGlvblRhcmdldFNyYy5cbiAgICAvLyBIb3dldmVyIHdlIHN0aWxsIHdhbnQgdG8gZ2l2ZSBpdCBhbiBBTUQgbW9kdWxlIG5hbWUgZm9yIGRldm1vZGUuXG4gICAgLy8gV2UgY2FuJ3QgZWFzaWx5IHRlbGwgd2hpY2ggZmlsZSBpcyB0aGUgc3ludGhldGljIG9uZSwgc28gd2UgYnVpbGQgdXAgdGhlIHBhdGggd2UgZXhwZWN0XG4gICAgLy8gaXQgdG8gaGF2ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oYmFzZVVybCwgZmxhdE1vZHVsZU91dFBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEFsc28gaGFuZGxlIHRoZSBjYXNlIHRoZSB0YXJnZXQgaXMgaW4gYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeS5cbiAgICAvLyBQdWxsIHRoZSB3b3Jrc3BhY2UgbmFtZSBmcm9tIHRoZSB0YXJnZXQgd2hpY2ggaXMgZm9ybWF0dGVkIGFzIGBAd2tzcC8vcGFja2FnZTp0YXJnZXRgXG4gICAgLy8gaWYgaXQgdGhlIHRhcmdldCBpcyBmcm9tIGFuIGV4dGVybmFsIHdvcmtzcGFjZS4gSWYgdGhlIHRhcmdldCBpcyBmcm9tIHRoZSBsb2NhbFxuICAgIC8vIHdvcmtzcGFjZSB0aGVuIGl0IHdpbGwgYmUgZm9ybWF0dGVkIGFzIGAvL3BhY2thZ2U6dGFyZ2V0YC5cbiAgICBjb25zdCB0YXJnZXRXb3Jrc3BhY2UgPSBiYXplbE9wdHMudGFyZ2V0LnNwbGl0KCcvJylbMF0ucmVwbGFjZSgvXkAvLCAnJyk7XG5cbiAgICBpZiAodGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICAgIGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oYmFzZVVybCwgJ2V4dGVybmFsJywgdGFyZ2V0V29ya3NwYWNlLCBmbGF0TW9kdWxlT3V0UGF0aCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSkgfHwgTkdDX0dFTl9GSUxFUy50ZXN0KGZpbGVOYW1lKTtcbiAgfTtcblxuICBjb25zdCBuZ0hvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnM6IGNvbXBpbGVyT3B0cywgdHNIb3N0OiBiYXplbEhvc3R9KTtcbiAgcGF0Y2hOZ0hvc3QoXG4gICAgICBuZ0hvc3QsIGNvbXBpbGVyT3B0cywgcm9vdERpcnMsIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLCBiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMsXG4gICAgICAhIXVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUpO1xuXG4gIG5nSG9zdC50b1N1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSA9PiBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSwgcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVOYW1lLCByb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHRzY3cucmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCB3b3Jrc3BhY2VSZWxhdGl2ZSkgKyAnLmQudHMnO1xuICAgIH07XG4gIH1cbiAgLy8gUGF0Y2ggYSBwcm9wZXJ0eSBvbiB0aGUgbmdIb3N0IHRoYXQgYWxsb3dzIHRoZSByZXNvdXJjZU5hbWVUb01vZHVsZU5hbWUgZnVuY3Rpb24gdG9cbiAgLy8gcmVwb3J0IGJldHRlciBlcnJvcnMuXG4gIChuZ0hvc3QgYXMgYW55KS5yZXBvcnRNaXNzaW5nUmVzb3VyY2UgPSAocmVzb3VyY2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGBcXG5Bc3NldCBub3QgZm91bmQ6XFxuICAke3Jlc291cmNlTmFtZX1gKTtcbiAgICBjb25zb2xlLmVycm9yKCdDaGVjayB0aGF0IGl0XFwncyBpbmNsdWRlZCBpbiB0aGUgYGFzc2V0c2AgYXR0cmlidXRlIG9mIHRoZSBgbmdfbW9kdWxlYCBydWxlLlxcbicpO1xuICB9O1xuXG4gIGNvbnN0IGVtaXRDYWxsYmFjazogbmcuVHNFbWl0Q2FsbGJhY2s8dHNpY2tsZS5FbWl0UmVzdWx0PiA9ICh7XG4gICAgcHJvZ3JhbSxcbiAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgIHdyaXRlRmlsZSxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICB9KSA9PlxuICAgICAgdHNpY2tsZS5lbWl0V2l0aFRzaWNrbGUoXG4gICAgICAgICAgcHJvZ3JhbSwgYmF6ZWxIb3N0ISwgYmF6ZWxIb3N0ISwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyLFxuICAgICAgICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlckRlY2xhcmF0aW9ucyxcbiAgICAgICAgICB9KTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtKTtcbiAgfVxuICBjb25zdCB7ZGlhZ25vc3RpY3MsIGVtaXRSZXN1bHQsIHByb2dyYW19ID0gbmcucGVyZm9ybUNvbXBpbGF0aW9uKHtcbiAgICByb290TmFtZXM6IGZpbGVzLFxuICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0cyxcbiAgICBob3N0OiBuZ0hvc3QsXG4gICAgZW1pdENhbGxiYWNrLFxuICAgIG1lcmdlRW1pdFJlc3VsdHNDYWxsYmFjazogdHNpY2tsZS5tZXJnZUVtaXRSZXN1bHRzLFxuICAgIGdhdGhlckRpYWdub3N0aWNzXG4gIH0pO1xuICBjb25zdCB0c2lja2xlRW1pdFJlc3VsdCA9IGVtaXRSZXN1bHQgYXMgdHNpY2tsZS5FbWl0UmVzdWx0O1xuICBsZXQgZXh0ZXJucyA9ICcvKiogQGV4dGVybnMgKi9cXG4nO1xuICBjb25zdCBoYXNFcnJvciA9IGRpYWdub3N0aWNzLnNvbWUoKGRpYWcpID0+IGRpYWcuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG4gIGlmICghaGFzRXJyb3IpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVHZW5lcmF0ZUV4dGVybnMpIHtcbiAgICAgIGV4dGVybnMgKz0gdHNpY2tsZS5nZXRHZW5lcmF0ZWRFeHRlcm5zKHRzaWNrbGVFbWl0UmVzdWx0LmV4dGVybnMsIHJvb3REaXIpO1xuICAgIH1cbiAgICBpZiAoYmF6ZWxPcHRzLm1hbmlmZXN0KSB7XG4gICAgICBjb25zdCBtYW5pZmVzdCA9IHRzY3cuY29uc3RydWN0TWFuaWZlc3QodHNpY2tsZUVtaXRSZXN1bHQubW9kdWxlc01hbmlmZXN0LCBiYXplbEhvc3QpO1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMubWFuaWZlc3QsIG1hbmlmZXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBjb21waWxhdGlvbiBmYWlscyB1bmV4cGVjdGVkbHksIHBlcmZvcm1Db21waWxhdGlvbiByZXR1cm5zIG5vIHByb2dyYW0uXG4gIC8vIE1ha2Ugc3VyZSBub3QgdG8gY3Jhc2ggYnV0IHJlcG9ydCB0aGUgZGlhZ25vc3RpY3MuXG4gIGlmICghcHJvZ3JhbSkgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG5cbiAgaWYgKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgpIHtcbiAgICAvLyBOb3RlOiB3aGVuIHRzaWNrbGVFeHRlcm5zUGF0aCBpcyBwcm92aWRlZCwgd2UgYWx3YXlzIHdyaXRlIGEgZmlsZSBhcyBhXG4gICAgLy8gbWFya2VyIHRoYXQgY29tcGlsYXRpb24gc3VjY2VlZGVkLCBldmVuIGlmIGl0J3MgZW1wdHkgKGp1c3QgY29udGFpbmluZyBhblxuICAgIC8vIEBleHRlcm5zKS5cbiAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgsIGV4dGVybnMpO1xuICB9XG5cbiAgLy8gVGhlcmUgbWlnaHQgYmUgc29tZSBleHBlY3RlZCBvdXRwdXQgZmlsZXMgdGhhdCBhcmUgbm90IHdyaXR0ZW4gYnkgdGhlXG4gIC8vIGNvbXBpbGVyLiBJbiB0aGlzIGNhc2UsIGp1c3Qgd3JpdGUgYW4gZW1wdHkgZmlsZS5cbiAgZm9yIChjb25zdCBmaWxlTmFtZSBvZiBleHBlY3RlZE91dHNTZXQpIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgJycsIGZhbHNlKTtcbiAgfVxuXG4gIGlmICghY29tcGlsZXJPcHRzLm5vRW1pdCkge1xuICAgIG1heWJlV3JpdGVVbnVzZWRJbnB1dHNMaXN0KHByb2dyYW0uZ2V0VHNQcm9ncmFtKCksIHJvb3REaXIsIGJhemVsT3B0cyk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBXcml0ZXMgYSBjb2xsZWN0aW9uIG9mIHVudXNlZCBpbnB1dCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgd2hpY2ggY2FuIGJlXG4gKiBjb25zdW1lZCBieSBiYXplbCB0byBhdm9pZCB0cmlnZ2VyaW5nIHJlYnVpbGRzIGlmIG9ubHkgdW51c2VkIGlucHV0cyBhcmVcbiAqIGNoYW5nZWQuXG4gKlxuICogU2VlIGh0dHBzOi8vYmF6ZWwuYnVpbGQvY29udHJpYnV0ZS9jb2RlYmFzZSNpbnB1dC1kaXNjb3ZlcnlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1heWJlV3JpdGVVbnVzZWRJbnB1dHNMaXN0KFxuICAgIHByb2dyYW06IHRzLlByb2dyYW0sIHJvb3REaXI6IHN0cmluZywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMpIHtcbiAgaWYgKCFiYXplbE9wdHM/LnVudXNlZElucHV0c0xpc3RQYXRoKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChiYXplbE9wdHMuYWxsb3dlZElucHV0cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdgdW51c2VkSW5wdXRzTGlzdFBhdGhgIGlzIHNldCwgYnV0IG5vIGxpc3Qgb2YgYWxsb3dlZCBpbnB1dHMgcHJvdmlkZWQuJyk7XG4gIH1cblxuICAvLyB0cy5Qcm9ncmFtJ3MgZ2V0U291cmNlRmlsZXMoKSBnZXRzIHBvcHVsYXRlZCBieSB0aGUgc291cmNlcyBhY3R1YWxseVxuICAvLyBsb2FkZWQgd2hpbGUgdGhlIHByb2dyYW0gaXMgYmVpbmcgYnVpbHQuXG4gIGNvbnN0IHVzZWRGaWxlcyA9IG5ldyBTZXQoKTtcbiAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgIC8vIE9ubHkgY29uY2VybiBvdXJzZWx2ZXMgd2l0aCB0eXBlc2NyaXB0IGZpbGVzLlxuICAgIHVzZWRGaWxlcy5hZGQoc291cmNlRmlsZS5maWxlTmFtZSk7XG4gIH1cblxuICAvLyBhbGxvd2VkSW5wdXRzIGFyZSBhYnNvbHV0ZSBwYXRocyB0byBmaWxlcyB3aGljaCBtYXkgYWxzbyBlbmQgd2l0aCAvKiB3aGljaFxuICAvLyBpbXBsaWVzIGFueSBmaWxlcyBpbiB0aGF0IGRpcmVjdG9yeSBjYW4gYmUgdXNlZC5cbiAgY29uc3QgdW51c2VkSW5wdXRzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGYgb2YgYmF6ZWxPcHRzLmFsbG93ZWRJbnB1dHMpIHtcbiAgICAvLyBBIHRzL3ggZmlsZSBpcyB1bnVzZWQgaWYgaXQgd2FzIG5vdCBmb3VuZCBkaXJlY3RseSBpbiB0aGUgdXNlZCBzb3VyY2VzLlxuICAgIGlmICgoZi5lbmRzV2l0aCgnLnRzJykgfHwgZi5lbmRzV2l0aCgnLnRzeCcpKSAmJiAhdXNlZEZpbGVzLmhhcyhmKSkge1xuICAgICAgdW51c2VkSW5wdXRzLnB1c2goZik7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBJdGVyYXRlIG92ZXIgY29udGVudHMgb2YgYWxsb3dlZCBkaXJlY3RvcmllcyBjaGVja2luZyBmb3IgdXNlZCBmaWxlcy5cbiAgfVxuXG4gIC8vIEJhemVsIGV4cGVjdHMgdGhlIHVudXNlZCBpbnB1dCBsaXN0IHRvIGNvbnRhaW4gcGF0aHMgcmVsYXRpdmUgdG8gdGhlXG4gIC8vIGV4ZWNyb290IGRpcmVjdG9yeS5cbiAgLy8gU2VlIGh0dHBzOi8vZG9jcy5iYXplbC5idWlsZC92ZXJzaW9ucy9tYWluL291dHB1dF9kaXJlY3Rvcmllcy5odG1sXG4gIGZzLndyaXRlRmlsZVN5bmMoXG4gICAgICBiYXplbE9wdHMudW51c2VkSW5wdXRzTGlzdFBhdGgsIHVudXNlZElucHV0cy5tYXAoZiA9PiBwYXRoLnJlbGF0aXZlKHJvb3REaXIsIGYpKS5qb2luKCdcXG4nKSk7XG59XG5cbmZ1bmN0aW9uIGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsIHNmOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhTkdDX0dFTl9GSUxFUy50ZXN0KHNmLmZpbGVOYW1lKSAmJlxuICAgICAgKGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmRleE9mKHNmLmZpbGVOYW1lKSAhPT0gLTEpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZmlsZVBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xufVxuXG5mdW5jdGlvbiBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoXG4gICAgb3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gIC8vIEZvciB0aGUgSXZ5IGNvbXBpbGVyLCB0cmFjayB0aGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgZmV0Y2hpbmcgVHlwZVNjcmlwdCBkaWFnbm9zdGljcy5cbiAgbGV0IHByZXZpb3VzUGhhc2UgPSBQZXJmUGhhc2UuVW5hY2NvdW50ZWQ7XG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBwcmV2aW91c1BoYXNlID0gbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShQZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzKTtcbiAgfVxuICBjb25zdCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKGYgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gIH1cblxuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShwcmV2aW91c1BoYXNlKTtcbiAgfVxuXG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgLy8gb25seSBnYXRoZXIgdGhlIGFuZ3VsYXIgZGlhZ25vc3RpY3MgaWYgd2UgaGF2ZSBubyBkaWFnbm9zdGljc1xuICAgIC8vIGluIGFueSBvdGhlciBmaWxlcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKiBLZXB0IGhlcmUganVzdCBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIDFQIHRvb2xzLiBUbyBiZSByZW1vdmVkIHNvb24gYWZ0ZXIgMVAgdXBkYXRlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgbmdIb3N0OiBuZy5Db21waWxlckhvc3QsIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICByb290RGlyczogc3RyaW5nW10sIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgcGF0Y2hOZ0hvc3QoXG4gICAgICBuZ0hvc3QsIGNvbXBpbGVyT3B0cywgcm9vdERpcnMsIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLCBiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMsXG4gICAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lKTtcbn1cbiJdfQ==