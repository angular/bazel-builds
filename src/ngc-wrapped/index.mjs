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
import ts from 'typescript';
import { EXT, patchNgHostWithFileNameToModuleName as patchNgHost, relativeToRootDirs } from './utils';
// FIXME: we should be able to add the assets to the tsconfig so FileLoader
// knows about them
const NGC_ASSETS = /\.(css|html)$/;
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
        return origBazelHostShouldNameModule(fileName);
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
    const emitCallback = ({ program, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers = {}, }) => program.emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
    if (!gatherDiagnostics) {
        gatherDiagnostics = (program) => gatherDiagnosticsForInputsOnly(compilerOpts, bazelOpts, program);
    }
    const { diagnostics, emitResult, program } = ng.performCompilation({ rootNames: files, options: compilerOpts, host: ngHost, emitCallback, gatherDiagnostics });
    let externs = '/** @externs */\n';
    const hasError = diagnostics.some((diag) => diag.category === ts.DiagnosticCategory.Error);
    if (!hasError) {
        if (bazelOpts.manifest) {
            fs.writeFileSync(bazelOpts.manifest, '// Empty. Should not be used.');
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
    return bazelOpts.compilationTargetSrc.indexOf(sf.fileName) !== -1;
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
        // In local mode compilation the TS semantic check issues tons of diagnostics due to the fact
        // that the file dependencies (.d.ts files) are not available in the program. So it needs to be
        // disabled.
        if (options.compilationMode !== 'experimental-local') {
            diagnostics.push(...tsProgram.getSemanticDiagnostics(sf));
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0ZBQXNGO0FBQ3RGLE9BQU8sS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sSUFBSSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUU1QixPQUFPLEVBQUMsR0FBRyxFQUFFLG1DQUFtQyxJQUFJLFdBQVcsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVFwRywyRUFBMkU7QUFDM0UsbUJBQW1CO0FBQ25CLE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQztBQUVuQyxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztBQUVwRCw0RUFBNEU7QUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7QUFFM0MsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsSUFBYztJQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDMUIsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0tBQ3ZDO1NBQU07UUFDTCxPQUFPLE1BQU0sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN4QztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELHVEQUF1RDtBQUN2RCxNQUFNLFNBQVMsR0FBRyxJQUFJLElB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bCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLyBgdHNjLXdyYXBwZWRgIGhlbHBlcnMgYXJlIG5vdCBleHBvc2VkIGluIHRoZSBwcmltYXJ5IGBAYmF6ZWwvY29uY2F0anNgIGVudHJ5LXBvaW50LlxuaW1wb3J0ICogYXMgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7UGVyZlBoYXNlfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCc7XG5pbXBvcnQgdHNjdyBmcm9tICdAYmF6ZWwvY29uY2F0anMvaW50ZXJuYWwvdHNjX3dyYXBwZWQvaW5kZXguanMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFWFQsIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lIGFzIHBhdGNoTmdIb3N0LCByZWxhdGl2ZVRvUm9vdERpcnN9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBBZGQgZGV2bW9kZSBmb3IgYmxhemUgaW50ZXJuYWxcbmludGVyZmFjZSBCYXplbE9wdGlvbnMgZXh0ZW5kcyB0c2N3LkJhemVsT3B0aW9ucyB7XG4gIGFsbG93ZWRJbnB1dHM/OiBzdHJpbmdbXTtcbiAgdW51c2VkSW5wdXRzTGlzdFBhdGg/OiBzdHJpbmc7XG59XG5cbi8vIEZJWE1FOiB3ZSBzaG91bGQgYmUgYWJsZSB0byBhZGQgdGhlIGFzc2V0cyB0byB0aGUgdHNjb25maWcgc28gRmlsZUxvYWRlclxuLy8ga25vd3MgYWJvdXQgdGhlbVxuY29uc3QgTkdDX0FTU0VUUyA9IC9cXC4oY3NzfGh0bWwpJC87XG5cbmNvbnN0IEJBWkVMX0JJTiA9IC9cXGIoYmxhemV8YmF6ZWwpLW91dFxcYi4qP1xcYmJpblxcYi87XG5cbi8vIE5vdGU6IFdlIGNvbXBpbGUgdGhlIGNvbnRlbnQgb2Ygbm9kZV9tb2R1bGVzIHdpdGggcGxhaW4gbmdjIGNvbW1hbmQgbGluZS5cbmNvbnN0IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwgPSBmYWxzZTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJnczogc3RyaW5nW10pIHtcbiAgaWYgKHRzY3cucnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCB0c2N3LnJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhd2FpdCBydW5PbmVCdWlsZChhcmdzKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgdHNjdy5GaWxlQ2FjaGU8dHMuU291cmNlRmlsZT4odHNjdy5kZWJ1Zyk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChcbiAgICBhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSB7XG4gICAgYXJncy5zaGlmdCgpO1xuICB9XG5cbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHRzY3cucGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHBhcnNlZE9wdGlvbnMgPT09IG51bGwpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgcGFyc2UgdHNjb25maWcuIE5vIHBhcnNlIGRpYWdub3N0aWNzIHByb3ZpZGVkLicpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICAgICdleHRlbmRlZERpYWdub3N0aWNzJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwge30gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuXG4gIC8vIEFuZ3VsYXIgQ29tcGlsZXIgb3B0aW9ucyBhcmUgYWx3YXlzIHNldCB1bmRlciBCYXplbC4gU2VlIGBuZ19tb2R1bGUuYnpsYC5cbiAgY29uc3QgYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMgPVxuICAgICAgKGNvbmZpZyBhcyB7YW5ndWxhckNvbXBpbGVyT3B0aW9uczogbmcuQW5ndWxhckNvbXBpbGVyT3B0aW9uc30pWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ107XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBuZy5Bbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMsXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGFuZ3VsYXJDb25maWdSYXdPcHRpb25zO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdCxcbn06IHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsPzogYm9vbGVhbixcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZT86IGJvb2xlYW4sIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLCB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCxcbiAgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICAgICAgZmlsZXM6IHN0cmluZ1tdLFxuICAgICAgICBleHBlY3RlZE91dHM6IHN0cmluZ1tdLFxuICBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiByZWFkb25seSB0cy5EaWFnbm9zdGljW10sXG4gIGJhemVsSG9zdD86IHRzY3cuQ29tcGlsZXJIb3N0LFxufSk6IHtkaWFnbm9zdGljczogcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfHVuZGVmaW5lZH0ge1xuICBsZXQgZmlsZUxvYWRlcjogdHNjdy5GaWxlTG9hZGVyO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHNldCBpbiBCYXplbC4gU2VlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9ydWxlc19ub2RlanMvYmxvYi81OTFlNzZlZGM5ZWUwYTcxZDYwNGM1OTk5YWY4YmFkNzkwOWVmMmQ0L3BhY2thZ2VzL2NvbmNhdGpzL2ludGVybmFsL2NvbW1vbi90c2NvbmZpZy5iemwjTDI0Ni5cbiAgY29uc3QgYmFzZVVybCA9IGNvbXBpbGVyT3B0cy5iYXNlVXJsITtcbiAgY29uc3Qgcm9vdERpciA9IGNvbXBpbGVyT3B0cy5yb290RGlyITtcbiAgY29uc3Qgcm9vdERpcnMgPSBjb21waWxlck9wdHMucm9vdERpcnMhO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgdHNjdy5DYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzLnNldCh0c2N3LnJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyB0c2N3LlVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IGZyb20gY29tcGlsZXJPcHRzIHdoZXRoZXIgdGhlIGVudHJ5cG9pbnQgaXMgYmVpbmcgaW52b2tlZCBpbiBJdnkgbW9kZS5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0c1NldCA9IG5ldyBTZXQoZXhwZWN0ZWRPdXRzLm1hcChwID0+IGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgocCkpKTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiByZWFkb25seSB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtyb290RGlyXSk7XG4gICAgICAgIGlmIChleHBlY3RlZE91dHNTZXQuaGFzKHJlbGF0aXZlKSkge1xuICAgICAgICAgIGV4cGVjdGVkT3V0c1NldC5kZWxldGUocmVsYXRpdmUpO1xuICAgICAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICBpZiAoIWJhemVsSG9zdCkge1xuICAgIGJhemVsSG9zdCA9IG5ldyB0c2N3LkNvbXBpbGVySG9zdChmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlcik7XG4gIH1cblxuICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAvLyBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBzaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgY2hlY2tzIHdoZXRoZXIgYGZpbGVOYW1lYCBpcyBwYXJ0IG9mXG4gICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAvLyBzaGltcyBmb3Igb3JpZ2luYWwgLnRzIGZpbGVzIGluIHRoZSBwcm9ncmFtIHNob3VsZCBiZSB0cmVhdGVkIGlkZW50aWNhbGx5LiBUaHVzLCBzdHJpcCB0aGVcbiAgICAvLyAnLm5nZmFjdG9yeScgb3IgJy5uZ3N1bW1hcnknIHBhcnQgb2YgdGhlIGZpbGVuYW1lIGF3YXkgYmVmb3JlIGNhbGxpbmcgdGhlIGRlbGVnYXRlLlxuICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICB9O1xuXG4gIC8vIE5ldmVyIHJ1biB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtLlxuICAvLyBUT0RPKGIvMjU0MDU0MTAzKTogUmVtb3ZlIHRoZSB0cmFuc2Zvcm0gYW5kIHRoaXMgZmxhZy5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlICYmICFiYXplbE9wdHMuZGV2bW9kZSkge1xuICAgIGlmIChiYXplbE9wdHMud29ya3NwYWNlTmFtZSA9PT0gJ2dvb2dsZTMnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBBbmd1bGFyIGNvbXBpbGVyIG9wdGlvbiBpcyBub3QgcmVzcGVjdGVkIGJ5IGRlZmF1bHRcbiAgLy8gYXMgbmdjLXdyYXBwZWQgaGFuZGxlcyB0c2lja2xlIGVtaXQgb24gaXRzIG93bi4gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gdXBkYXRlXG4gIC8vIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QgYmFzZWQgb24gdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgZmxhZy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gIH1cblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3Qgb3JpZ0JhemVsSG9zdEZpbGVFeGlzdCA9IGJhemVsSG9zdC5maWxlRXhpc3RzO1xuICBiYXplbEhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKE5HQ19BU1NFVFMudGVzdChmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0LmNhbGwoYmF6ZWxIb3N0LCBmaWxlTmFtZSk7XG4gIH07XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlID0gYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZmxhdE1vZHVsZU91dFBhdGggPVxuICAgICAgICBwYXRoLnBvc2l4LmpvaW4oYmF6ZWxPcHRzLnBhY2thZ2UsIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnKTtcblxuICAgIC8vIFRoZSBidW5kbGUgaW5kZXggZmlsZSBpcyBzeW50aGVzaXplZCBpbiBidW5kbGVfaW5kZXhfaG9zdCBzbyBpdCdzIG5vdCBpbiB0aGVcbiAgICAvLyBjb21waWxhdGlvblRhcmdldFNyYy5cbiAgICAvLyBIb3dldmVyIHdlIHN0aWxsIHdhbnQgdG8gZ2l2ZSBpdCBhbiBBTUQgbW9kdWxlIG5hbWUgZm9yIGRldm1vZGUuXG4gICAgLy8gV2UgY2FuJ3QgZWFzaWx5IHRlbGwgd2hpY2ggZmlsZSBpcyB0aGUgc3ludGhldGljIG9uZSwgc28gd2UgYnVpbGQgdXAgdGhlIHBhdGggd2UgZXhwZWN0XG4gICAgLy8gaXQgdG8gaGF2ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oYmFzZVVybCwgZmxhdE1vZHVsZU91dFBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEFsc28gaGFuZGxlIHRoZSBjYXNlIHRoZSB0YXJnZXQgaXMgaW4gYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeS5cbiAgICAvLyBQdWxsIHRoZSB3b3Jrc3BhY2UgbmFtZSBmcm9tIHRoZSB0YXJnZXQgd2hpY2ggaXMgZm9ybWF0dGVkIGFzIGBAd2tzcC8vcGFja2FnZTp0YXJnZXRgXG4gICAgLy8gaWYgaXQgdGhlIHRhcmdldCBpcyBmcm9tIGFuIGV4dGVybmFsIHdvcmtzcGFjZS4gSWYgdGhlIHRhcmdldCBpcyBmcm9tIHRoZSBsb2NhbFxuICAgIC8vIHdvcmtzcGFjZSB0aGVuIGl0IHdpbGwgYmUgZm9ybWF0dGVkIGFzIGAvL3BhY2thZ2U6dGFyZ2V0YC5cbiAgICBjb25zdCB0YXJnZXRXb3Jrc3BhY2UgPSBiYXplbE9wdHMudGFyZ2V0LnNwbGl0KCcvJylbMF0ucmVwbGFjZSgvXkAvLCAnJyk7XG5cbiAgICBpZiAodGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICAgIGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oYmFzZVVybCwgJ2V4dGVybmFsJywgdGFyZ2V0V29ya3NwYWNlLCBmbGF0TW9kdWxlT3V0UGF0aCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIHBhdGNoTmdIb3N0KFxuICAgICAgbmdIb3N0LCBjb21waWxlck9wdHMsIHJvb3REaXJzLCBiYXplbE9wdHMud29ya3NwYWNlTmFtZSwgYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLFxuICAgICAgISF1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lKTtcblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZSwgcm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJykpO1xuICBpZiAoYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsKSB7XG4gICAgLy8gTm90ZTogVGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gd291bGQgd29yayBhcyB3ZWxsLFxuICAgIC8vIGJ1dCB3ZSBjYW4gYmUgZmFzdGVyIGFzIHdlIGtub3cgaG93IGB0b1N1bW1hcnlGaWxlTmFtZWAgd29ya3MuXG4gICAgLy8gTm90ZTogV2UgY2FuJ3QgZG8gdGhpcyBpZiBzb21lIGRlcHMgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggdGhlIGNvbW1hbmQgbGluZSxcbiAgICAvLyBhcyB0aGF0IGhhcyBhIGRpZmZlcmVudCBpbXBsZW1lbnRhdGlvbiBvZiBmcm9tU3VtbWFyeUZpbGVOYW1lIC8gdG9TdW1tYXJ5RmlsZU5hbWVcbiAgICBuZ0hvc3QuZnJvbVN1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdMaWJGaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSZWxhdGl2ZSA9IGZpbGVOYW1lLnNwbGl0KCcvJykuc3BsaWNlKDEpLmpvaW4oJy8nKTtcbiAgICAgIHJldHVybiB0c2N3LnJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IG5nLlRzRW1pdENhbGxiYWNrPHRzLkVtaXRSZXN1bHQ+ID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICBwcm9ncmFtLmVtaXQoXG4gICAgICAgICAgdGFyZ2V0U291cmNlRmlsZSwgd3JpdGVGaWxlLCBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywgY3VzdG9tVHJhbnNmb3JtZXJzKTtcblxuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0pO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oXG4gICAgICB7cm9vdE5hbWVzOiBmaWxlcywgb3B0aW9uczogY29tcGlsZXJPcHRzLCBob3N0OiBuZ0hvc3QsIGVtaXRDYWxsYmFjaywgZ2F0aGVyRGlhZ25vc3RpY3N9KTtcbiAgbGV0IGV4dGVybnMgPSAnLyoqIEBleHRlcm5zICovXFxuJztcbiAgY29uc3QgaGFzRXJyb3IgPSBkaWFnbm9zdGljcy5zb21lKChkaWFnKSA9PiBkaWFnLmNhdGVnb3J5ID09PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xuICBpZiAoIWhhc0Vycm9yKSB7XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMubWFuaWZlc3QsICcvLyBFbXB0eS4gU2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCkge1xuICAgIC8vIE5vdGU6IHdoZW4gdHNpY2tsZUV4dGVybnNQYXRoIGlzIHByb3ZpZGVkLCB3ZSBhbHdheXMgd3JpdGUgYSBmaWxlIGFzIGFcbiAgICAvLyBtYXJrZXIgdGhhdCBjb21waWxhdGlvbiBzdWNjZWVkZWQsIGV2ZW4gaWYgaXQncyBlbXB0eSAoanVzdCBjb250YWluaW5nIGFuXG4gICAgLy8gQGV4dGVybnMpLlxuICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCwgZXh0ZXJucyk7XG4gIH1cblxuICAvLyBUaGVyZSBtaWdodCBiZSBzb21lIGV4cGVjdGVkIG91dHB1dCBmaWxlcyB0aGF0IGFyZSBub3Qgd3JpdHRlbiBieSB0aGVcbiAgLy8gY29tcGlsZXIuIEluIHRoaXMgY2FzZSwganVzdCB3cml0ZSBhbiBlbXB0eSBmaWxlLlxuICBmb3IgKGNvbnN0IGZpbGVOYW1lIG9mIGV4cGVjdGVkT3V0c1NldCkge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCAnJywgZmFsc2UpO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMubm9FbWl0KSB7XG4gICAgbWF5YmVXcml0ZVVudXNlZElucHV0c0xpc3QocHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSwgcm9vdERpciwgYmF6ZWxPcHRzKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG4vKipcbiAqIFdyaXRlcyBhIGNvbGxlY3Rpb24gb2YgdW51c2VkIGlucHV0IGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aGljaCBjYW4gYmVcbiAqIGNvbnN1bWVkIGJ5IGJhemVsIHRvIGF2b2lkIHRyaWdnZXJpbmcgcmVidWlsZHMgaWYgb25seSB1bnVzZWQgaW5wdXRzIGFyZVxuICogY2hhbmdlZC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9iYXplbC5idWlsZC9jb250cmlidXRlL2NvZGViYXNlI2lucHV0LWRpc2NvdmVyeVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVXcml0ZVVudXNlZElucHV0c0xpc3QoXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgcm9vdERpcjogc3RyaW5nLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucykge1xuICBpZiAoIWJhemVsT3B0cz8udW51c2VkSW5wdXRzTGlzdFBhdGgpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGJhemVsT3B0cy5hbGxvd2VkSW5wdXRzID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2B1bnVzZWRJbnB1dHNMaXN0UGF0aGAgaXMgc2V0LCBidXQgbm8gbGlzdCBvZiBhbGxvd2VkIGlucHV0cyBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIHRzLlByb2dyYW0ncyBnZXRTb3VyY2VGaWxlcygpIGdldHMgcG9wdWxhdGVkIGJ5IHRoZSBzb3VyY2VzIGFjdHVhbGx5XG4gIC8vIGxvYWRlZCB3aGlsZSB0aGUgcHJvZ3JhbSBpcyBiZWluZyBidWlsdC5cbiAgY29uc3QgdXNlZEZpbGVzID0gbmV3IFNldCgpO1xuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgLy8gT25seSBjb25jZXJuIG91cnNlbHZlcyB3aXRoIHR5cGVzY3JpcHQgZmlsZXMuXG4gICAgdXNlZEZpbGVzLmFkZChzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgfVxuXG4gIC8vIGFsbG93ZWRJbnB1dHMgYXJlIGFic29sdXRlIHBhdGhzIHRvIGZpbGVzIHdoaWNoIG1heSBhbHNvIGVuZCB3aXRoIC8qIHdoaWNoXG4gIC8vIGltcGxpZXMgYW55IGZpbGVzIGluIHRoYXQgZGlyZWN0b3J5IGNhbiBiZSB1c2VkLlxuICBjb25zdCB1bnVzZWRJbnB1dHM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgZiBvZiBiYXplbE9wdHMuYWxsb3dlZElucHV0cykge1xuICAgIC8vIEEgdHMveCBmaWxlIGlzIHVudXNlZCBpZiBpdCB3YXMgbm90IGZvdW5kIGRpcmVjdGx5IGluIHRoZSB1c2VkIHNvdXJjZXMuXG4gICAgaWYgKChmLmVuZHNXaXRoKCcudHMnKSB8fCBmLmVuZHNXaXRoKCcudHN4JykpICYmICF1c2VkRmlsZXMuaGFzKGYpKSB7XG4gICAgICB1bnVzZWRJbnB1dHMucHVzaChmKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRPRE86IEl0ZXJhdGUgb3ZlciBjb250ZW50cyBvZiBhbGxvd2VkIGRpcmVjdG9yaWVzIGNoZWNraW5nIGZvciB1c2VkIGZpbGVzLlxuICB9XG5cbiAgLy8gQmF6ZWwgZXhwZWN0cyB0aGUgdW51c2VkIGlucHV0IGxpc3QgdG8gY29udGFpbiBwYXRocyByZWxhdGl2ZSB0byB0aGVcbiAgLy8gZXhlY3Jvb3QgZGlyZWN0b3J5LlxuICAvLyBTZWUgaHR0cHM6Ly9kb2NzLmJhemVsLmJ1aWxkL3ZlcnNpb25zL21haW4vb3V0cHV0X2RpcmVjdG9yaWVzLmh0bWxcbiAgZnMud3JpdGVGaWxlU3luYyhcbiAgICAgIGJhemVsT3B0cy51bnVzZWRJbnB1dHNMaXN0UGF0aCwgdW51c2VkSW5wdXRzLm1hcChmID0+IHBhdGgucmVsYXRpdmUocm9vdERpciwgZikpLmpvaW4oJ1xcbicpKTtcbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmRleE9mKHNmLmZpbGVOYW1lKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgICBvcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBuZ1Byb2dyYW06IG5nLlByb2dyYW0pOiB0cy5EaWFnbm9zdGljW10ge1xuICBjb25zdCB0c1Byb2dyYW0gPSBuZ1Byb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG5cbiAgLy8gRm9yIHRoZSBJdnkgY29tcGlsZXIsIHRyYWNrIHRoZSBhbW91bnQgb2YgdGltZSBzcGVudCBmZXRjaGluZyBUeXBlU2NyaXB0IGRpYWdub3N0aWNzLlxuICBsZXQgcHJldmlvdXNQaGFzZSA9IFBlcmZQaGFzZS5VbmFjY291bnRlZDtcbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIHByZXZpb3VzUGhhc2UgPSBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKFBlcmZQaGFzZS5UeXBlU2NyaXB0RGlhZ25vc3RpY3MpO1xuICB9XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoZiA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuXG4gICAgLy8gSW4gbG9jYWwgbW9kZSBjb21waWxhdGlvbiB0aGUgVFMgc2VtYW50aWMgY2hlY2sgaXNzdWVzIHRvbnMgb2YgZGlhZ25vc3RpY3MgZHVlIHRvIHRoZSBmYWN0XG4gICAgLy8gdGhhdCB0aGUgZmlsZSBkZXBlbmRlbmNpZXMgKC5kLnRzIGZpbGVzKSBhcmUgbm90IGF2YWlsYWJsZSBpbiB0aGUgcHJvZ3JhbS4gU28gaXQgbmVlZHMgdG8gYmVcbiAgICAvLyBkaXNhYmxlZC5cbiAgICBpZiAob3B0aW9ucy5jb21waWxhdGlvbk1vZGUgIT09ICdleHBlcmltZW50YWwtbG9jYWwnKSB7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UocHJldmlvdXNQaGFzZSk7XG4gIH1cblxuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIC8vIG9ubHkgZ2F0aGVyIHRoZSBhbmd1bGFyIGRpYWdub3N0aWNzIGlmIHdlIGhhdmUgbm8gZGlhZ25vc3RpY3NcbiAgICAvLyBpbiBhbnkgb3RoZXIgZmlsZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogS2VwdCBoZXJlIGp1c3QgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCAxUCB0b29scy4gVG8gYmUgcmVtb3ZlZCBzb29uIGFmdGVyIDFQIHVwZGF0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICAgIG5nSG9zdDogbmcuQ29tcGlsZXJIb3N0LCBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgcm9vdERpcnM6IHN0cmluZ1tdLCB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBib29sZWFuKTogdm9pZCB7XG4gIHBhdGNoTmdIb3N0KFxuICAgICAgbmdIb3N0LCBjb21waWxlck9wdHMsIHJvb3REaXJzLCBiYXplbE9wdHMud29ya3NwYWNlTmFtZSwgYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLFxuICAgICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSk7XG59XG4iXX0=