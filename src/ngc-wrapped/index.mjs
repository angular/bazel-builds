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
        return (await runOneBuild(args)) ? 0 : 1;
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
        'forbidOrphanComponents',
        'onlyExplicitDeferDependencyImports',
        'generateExtraImportsInLocalMode',
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
    return diagnostics.every((d) => d.category !== ts.DiagnosticCategory.Error);
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
    const bazelBin = compilerOpts.rootDirs.find((rootDir) => BAZEL_BIN.test(rootDir));
    if (!bazelBin) {
        throw new Error(`Couldn't find bazel bin in the rootDirs: ${compilerOpts.rootDirs}`);
    }
    const expectedOutsSet = new Set(expectedOuts.map((p) => convertToForwardSlashPath(p)));
    const originalWriteFile = tsHost.writeFile.bind(tsHost);
    tsHost.writeFile = (fileName, content, writeByteOrderMark, onError, sourceFiles) => {
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
        console.error("Check that it's included in the `assets` attribute of the `ng_module` rule.\n");
    };
    const emitCallback = ({ program, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers = {}, }) => program.emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
    if (!gatherDiagnostics) {
        gatherDiagnostics = (program) => gatherDiagnosticsForInputsOnly(compilerOpts, bazelOpts, program);
    }
    const { diagnostics, emitResult, program } = ng.performCompilation({
        rootNames: files,
        options: compilerOpts,
        host: ngHost,
        emitCallback,
        gatherDiagnostics,
    });
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
    fs.writeFileSync(bazelOpts.unusedInputsListPath, unusedInputs.map((f) => path.relative(rootDir, f)).join('\n'));
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
    const programFiles = tsProgram.getSourceFiles().filter((f) => isCompilationTarget(bazelOpts, f));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0ZBQXNGO0FBQ3RGLE9BQU8sS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sSUFBSSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUU1QixPQUFPLEVBQUMsR0FBRyxFQUFFLG1DQUFtQyxJQUFJLFdBQVcsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVFwRywyRUFBMkU7QUFDM0UsbUJBQW1CO0FBQ25CLE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQztBQUVuQyxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztBQUVwRCw0RUFBNEU7QUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7QUFFM0MsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsSUFBYztJQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUMzQixNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDeEMsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLENBQUMsTUFBTSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELHVEQUF1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UUFDeEIsZ0VBQWdFO1FBQ2hFLHNCQUFzQjtRQUN0QixXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUM1RCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHdCQUF3QixFQUFFLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBQ0QsT0FBTyxXQUFXLENBQUM7QUFDckIsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxtQ0FBbUMsQ0FDakQsTUFBdUIsRUFDdkIsWUFBZ0MsRUFDaEMsU0FBdUIsRUFDdkIsUUFBa0IsRUFDbEIsNEJBQXFDO0lBRXJDLFdBQVcsQ0FDVCxNQUFNLEVBQ04sWUFBWSxFQUNaLFFBQVEsRUFDUixTQUFTLENBQUMsYUFBYSxFQUN2QixTQUFTLENBQUMsb0JBQW9CLEVBQzlCLDRCQUE0QixDQUM3QixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLyBgdHNjLXdyYXBwZWRgIGhlbHBlcnMgYXJlIG5vdCBleHBvc2VkIGluIHRoZSBwcmltYXJ5IGBAYmF6ZWwvY29uY2F0anNgIGVudHJ5LXBvaW50LlxuaW1wb3J0ICogYXMgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7UGVyZlBoYXNlfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCc7XG5pbXBvcnQgdHNjdyBmcm9tICdAYmF6ZWwvY29uY2F0anMvaW50ZXJuYWwvdHNjX3dyYXBwZWQvaW5kZXguanMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtFWFQsIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lIGFzIHBhdGNoTmdIb3N0LCByZWxhdGl2ZVRvUm9vdERpcnN9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBBZGQgZGV2bW9kZSBmb3IgYmxhemUgaW50ZXJuYWxcbmludGVyZmFjZSBCYXplbE9wdGlvbnMgZXh0ZW5kcyB0c2N3LkJhemVsT3B0aW9ucyB7XG4gIGFsbG93ZWRJbnB1dHM/OiBzdHJpbmdbXTtcbiAgdW51c2VkSW5wdXRzTGlzdFBhdGg/OiBzdHJpbmc7XG59XG5cbi8vIEZJWE1FOiB3ZSBzaG91bGQgYmUgYWJsZSB0byBhZGQgdGhlIGFzc2V0cyB0byB0aGUgdHNjb25maWcgc28gRmlsZUxvYWRlclxuLy8ga25vd3MgYWJvdXQgdGhlbVxuY29uc3QgTkdDX0FTU0VUUyA9IC9cXC4oY3NzfGh0bWwpJC87XG5cbmNvbnN0IEJBWkVMX0JJTiA9IC9cXGIoYmxhemV8YmF6ZWwpLW91dFxcYi4qP1xcYmJpblxcYi87XG5cbi8vIE5vdGU6IFdlIGNvbXBpbGUgdGhlIGNvbnRlbnQgb2Ygbm9kZV9tb2R1bGVzIHdpdGggcGxhaW4gbmdjIGNvbW1hbmQgbGluZS5cbmNvbnN0IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwgPSBmYWxzZTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJnczogc3RyaW5nW10pIHtcbiAgaWYgKHRzY3cucnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCB0c2N3LnJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoYXdhaXQgcnVuT25lQnVpbGQoYXJncykpID8gMCA6IDE7XG4gIH1cbiAgcmV0dXJuIDA7XG59XG5cbi8qKiBUaGUgb25lIEZpbGVDYWNoZSBpbnN0YW5jZSB1c2VkIGluIHRoaXMgcHJvY2Vzcy4gKi9cbmNvbnN0IGZpbGVDYWNoZSA9IG5ldyB0c2N3LkZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPih0c2N3LmRlYnVnKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bk9uZUJ1aWxkKFxuICBhcmdzOiBzdHJpbmdbXSxcbiAgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSB7XG4gICAgYXJncy5zaGlmdCgpO1xuICB9XG5cbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHRzY3cucGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHBhcnNlZE9wdGlvbnMgPT09IG51bGwpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgcGFyc2UgdHNjb25maWcuIE5vIHBhcnNlIGRpYWdub3N0aWNzIHByb3ZpZGVkLicpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICAgICdleHRlbmRlZERpYWdub3N0aWNzJyxcbiAgICAnZm9yYmlkT3JwaGFuQ29tcG9uZW50cycsXG4gICAgJ29ubHlFeHBsaWNpdERlZmVyRGVwZW5kZW5jeUltcG9ydHMnLFxuICAgICdnZW5lcmF0ZUV4dHJhSW1wb3J0c0luTG9jYWxNb2RlJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgLnJlZHVjZShcbiAgICAgIChvYmosIFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICBvYmpba2V5XSA9IHZhbHVlO1xuXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB9LFxuICAgICAge30gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgKTtcblxuICAvLyBBbmd1bGFyIENvbXBpbGVyIG9wdGlvbnMgYXJlIGFsd2F5cyBzZXQgdW5kZXIgQmF6ZWwuIFNlZSBgbmdfbW9kdWxlLmJ6bGAuXG4gIGNvbnN0IGFuZ3VsYXJDb25maWdSYXdPcHRpb25zID0gKGNvbmZpZyBhcyB7YW5ndWxhckNvbXBpbGVyT3B0aW9uczogbmcuQW5ndWxhckNvbXBpbGVyT3B0aW9uc30pW1xuICAgICdhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ1xuICBdO1xuXG4gIGNvbnN0IGNvbXBpbGVyT3B0czogbmcuQW5ndWxhckNvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICAuLi51c2VyT3ZlcnJpZGVzLFxuICAgIC4uLmFuZ3VsYXJDb25maWdSYXdPcHRpb25zLFxuICAgIC4uLnRzT3B0aW9ucyxcbiAgfTtcblxuICAvLyBUaGVzZSBhcmUgb3B0aW9ucyBwYXNzZWQgdGhyb3VnaCBmcm9tIHRoZSBgbmdfbW9kdWxlYCBydWxlIHdoaWNoIGFyZW4ndCBzdXBwb3J0ZWRcbiAgLy8gYnkgdGhlIGBAYW5ndWxhci9jb21waWxlci1jbGlgIGFuZCBhcmUgb25seSBpbnRlbmRlZCBmb3IgYG5nYy13cmFwcGVkYC5cbiAgY29uc3Qge2V4cGVjdGVkT3V0LCBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZX0gPSBhbmd1bGFyQ29uZmlnUmF3T3B0aW9ucztcblxuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgICBleHBlY3RlZE91dHM6IGV4cGVjdGVkT3V0LFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICB0c0hvc3QsXG4gICAgYmF6ZWxPcHRzLFxuICAgIGZpbGVzLFxuICAgIGlucHV0cyxcbiAgfSk7XG4gIGlmIChkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGRpYWdub3N0aWNzKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzLmV2ZXJ5KChkKSA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdCxcbn06IHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsPzogYm9vbGVhbjtcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZT86IGJvb2xlYW47XG4gIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zO1xuICB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdDtcbiAgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9O1xuICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucztcbiAgZmlsZXM6IHN0cmluZ1tdO1xuICBleHBlY3RlZE91dHM6IHN0cmluZ1tdO1xuICBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiByZWFkb25seSB0cy5EaWFnbm9zdGljW107XG4gIGJhemVsSG9zdD86IHRzY3cuQ29tcGlsZXJIb3N0O1xufSk6IHtkaWFnbm9zdGljczogcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdOyBwcm9ncmFtOiBuZy5Qcm9ncmFtIHwgdW5kZWZpbmVkfSB7XG4gIGxldCBmaWxlTG9hZGVyOiB0c2N3LkZpbGVMb2FkZXI7XG5cbiAgLy8gVGhlc2Ugb3B0aW9ucyBhcmUgZXhwZWN0ZWQgdG8gYmUgc2V0IGluIEJhemVsLiBTZWU6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iYXplbGJ1aWxkL3J1bGVzX25vZGVqcy9ibG9iLzU5MWU3NmVkYzllZTBhNzFkNjA0YzU5OTlhZjhiYWQ3OTA5ZWYyZDQvcGFja2FnZXMvY29uY2F0anMvaW50ZXJuYWwvY29tbW9uL3RzY29uZmlnLmJ6bCNMMjQ2LlxuICBjb25zdCBiYXNlVXJsID0gY29tcGlsZXJPcHRzLmJhc2VVcmwhO1xuICBjb25zdCByb290RGlyID0gY29tcGlsZXJPcHRzLnJvb3REaXIhO1xuICBjb25zdCByb290RGlycyA9IGNvbXBpbGVyT3B0cy5yb290RGlycyE7XG5cbiAgaWYgKGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbWF4Q2FjaGVTaXplQnl0ZXMgPSBiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgKiAoMSA8PCAyMCk7XG4gICAgZmlsZUNhY2hlLnNldE1heENhY2hlU2l6ZShtYXhDYWNoZVNpemVCeXRlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUNhY2hlLnJlc2V0TWF4Q2FjaGVTaXplKCk7XG4gIH1cblxuICBpZiAoaW5wdXRzKSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyB0c2N3LkNhY2hlZEZpbGVMb2FkZXIoZmlsZUNhY2hlKTtcbiAgICAvLyBSZXNvbHZlIHRoZSBpbnB1dHMgdG8gYWJzb2x1dGUgcGF0aHMgdG8gbWF0Y2ggVHlwZVNjcmlwdCBpbnRlcm5hbHNcbiAgICBjb25zdCByZXNvbHZlZElucHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMoaW5wdXRzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0S2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qga2V5ID0gaW5wdXRLZXlzW2ldO1xuICAgICAgcmVzb2x2ZWRJbnB1dHMuc2V0KHRzY3cucmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGtleSksIGlucHV0c1trZXldKTtcbiAgICB9XG4gICAgZmlsZUNhY2hlLnVwZGF0ZUNhY2hlKHJlc29sdmVkSW5wdXRzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IHRzY3cuVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICAvLyBEZXRlY3QgZnJvbSBjb21waWxlck9wdHMgd2hldGhlciB0aGUgZW50cnlwb2ludCBpcyBiZWluZyBpbnZva2VkIGluIEl2eSBtb2RlLlxuICBpZiAoIWNvbXBpbGVyT3B0cy5yb290RGlycykge1xuICAgIHRocm93IG5ldyBFcnJvcigncm9vdERpcnMgaXMgbm90IHNldCEnKTtcbiAgfVxuICBjb25zdCBiYXplbEJpbiA9IGNvbXBpbGVyT3B0cy5yb290RGlycy5maW5kKChyb290RGlyKSA9PiBCQVpFTF9CSU4udGVzdChyb290RGlyKSk7XG4gIGlmICghYmF6ZWxCaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgYmF6ZWwgYmluIGluIHRoZSByb290RGlyczogJHtjb21waWxlck9wdHMucm9vdERpcnN9YCk7XG4gIH1cblxuICBjb25zdCBleHBlY3RlZE91dHNTZXQgPSBuZXcgU2V0KGV4cGVjdGVkT3V0cy5tYXAoKHApID0+IGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgocCkpKTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID0gKFxuICAgIGZpbGVOYW1lOiBzdHJpbmcsXG4gICAgY29udGVudDogc3RyaW5nLFxuICAgIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCxcbiAgICBzb3VyY2VGaWxlcz86IHJlYWRvbmx5IHRzLlNvdXJjZUZpbGVbXSxcbiAgKSA9PiB7XG4gICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtyb290RGlyXSk7XG4gICAgaWYgKGV4cGVjdGVkT3V0c1NldC5oYXMocmVsYXRpdmUpKSB7XG4gICAgICBleHBlY3RlZE91dHNTZXQuZGVsZXRlKHJlbGF0aXZlKTtcbiAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKCFiYXplbEhvc3QpIHtcbiAgICBiYXplbEhvc3QgPSBuZXcgdHNjdy5Db21waWxlckhvc3QoZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIpO1xuICB9XG5cbiAgY29uc3QgZGVsZWdhdGUgPSBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgLy8gVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2Ygc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nIGNoZWNrcyB3aGV0aGVyIGBmaWxlTmFtZWAgaXMgcGFydCBvZlxuICAgIC8vIHRoZSBvcmlnaW5hbCBgc3Jjc1tdYC4gRm9yIEFuZ3VsYXIgKEl2eSkgY29tcGlsYXRpb25zLCBuZ2ZhY3RvcnkvbmdzdW1tYXJ5IGZpbGVzIHRoYXQgYXJlXG4gICAgLy8gc2hpbXMgZm9yIG9yaWdpbmFsIC50cyBmaWxlcyBpbiB0aGUgcHJvZ3JhbSBzaG91bGQgYmUgdHJlYXRlZCBpZGVudGljYWxseS4gVGh1cywgc3RyaXAgdGhlXG4gICAgLy8gJy5uZ2ZhY3RvcnknIG9yICcubmdzdW1tYXJ5JyBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBhd2F5IGJlZm9yZSBjYWxsaW5nIHRoZSBkZWxlZ2F0ZS5cbiAgICByZXR1cm4gZGVsZWdhdGUoZmlsZU5hbWUucmVwbGFjZSgvXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnkpXFwudHMkLywgJy50cycpKTtcbiAgfTtcblxuICAvLyBOZXZlciBydW4gdGhlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybS5cbiAgLy8gVE9ETyhiLzI1NDA1NDEwMyk6IFJlbW92ZSB0aGUgdHJhbnNmb3JtIGFuZCB0aGlzIGZsYWcuXG4gIGJhemVsSG9zdC50cmFuc2Zvcm1EZWNvcmF0b3JzID0gZmFsc2U7XG5cbiAgLy8gQnkgZGVmYXVsdCBpbiB0aGUgYHByb2Rtb2RlYCBvdXRwdXQsIHdlIGRvIG5vdCBhZGQgYW5ub3RhdGlvbnMgZm9yIGNsb3N1cmUgY29tcGlsZXIuXG4gIC8vIFRob3VnaCwgaWYgd2UgYXJlIGJ1aWxkaW5nIGluc2lkZSBgZ29vZ2xlM2AsIGNsb3N1cmUgYW5ub3RhdGlvbnMgYXJlIGRlc2lyZWQgZm9yXG4gIC8vIHByb2Rtb2RlIG91dHB1dCwgc28gd2UgZW5hYmxlIGl0IGJ5IGRlZmF1bHQuIFRoZSBkZWZhdWx0cyBjYW4gYmUgb3ZlcnJpZGRlbiBieVxuICAvLyBzZXR0aW5nIHRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIGNvbXBpbGVyIG9wdGlvbiBpbiB0aGUgdXNlciB0c2NvbmZpZy5cbiAgaWYgKCFiYXplbE9wdHMuZXM1TW9kZSAmJiAhYmF6ZWxPcHRzLmRldm1vZGUpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUgPT09ICdnb29nbGUzJykge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgQW5ndWxhciBjb21waWxlciBvcHRpb24gaXMgbm90IHJlc3BlY3RlZCBieSBkZWZhdWx0XG4gIC8vIGFzIG5nYy13cmFwcGVkIGhhbmRsZXMgdHNpY2tsZSBlbWl0IG9uIGl0cyBvd24uIFRoaXMgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHVwZGF0ZVxuICAvLyB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0IGJhc2VkIG9uIHRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIGZsYWcuXG4gIGlmIChjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIpIHtcbiAgICBiYXplbEhvc3QudHJhbnNmb3JtVHlwZXNUb0Nsb3N1cmUgPSB0cnVlO1xuICB9XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID0gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLnBhY2thZ2UsXG4gICAgICBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyxcbiAgICApO1xuXG4gICAgLy8gVGhlIGJ1bmRsZSBpbmRleCBmaWxlIGlzIHN5bnRoZXNpemVkIGluIGJ1bmRsZV9pbmRleF9ob3N0IHNvIGl0J3Mgbm90IGluIHRoZVxuICAgIC8vIGNvbXBpbGF0aW9uVGFyZ2V0U3JjLlxuICAgIC8vIEhvd2V2ZXIgd2Ugc3RpbGwgd2FudCB0byBnaXZlIGl0IGFuIEFNRCBtb2R1bGUgbmFtZSBmb3IgZGV2bW9kZS5cbiAgICAvLyBXZSBjYW4ndCBlYXNpbHkgdGVsbCB3aGljaCBmaWxlIGlzIHRoZSBzeW50aGV0aWMgb25lLCBzbyB3ZSBidWlsZCB1cCB0aGUgcGF0aCB3ZSBleHBlY3RcbiAgICAvLyBpdCB0byBoYXZlIGFuZCBjb21wYXJlIGFnYWluc3QgdGhhdC5cbiAgICBpZiAoZmlsZU5hbWUgPT09IHBhdGgucG9zaXguam9pbihiYXNlVXJsLCBmbGF0TW9kdWxlT3V0UGF0aCkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcblxuICAgIGlmIChcbiAgICAgIHRhcmdldFdvcmtzcGFjZSAmJlxuICAgICAgZmlsZU5hbWUgPT09IHBhdGgucG9zaXguam9pbihiYXNlVXJsLCAnZXh0ZXJuYWwnLCB0YXJnZXRXb3Jrc3BhY2UsIGZsYXRNb2R1bGVPdXRQYXRoKVxuICAgIClcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlKGZpbGVOYW1lKTtcbiAgfTtcblxuICBjb25zdCBuZ0hvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnM6IGNvbXBpbGVyT3B0cywgdHNIb3N0OiBiYXplbEhvc3R9KTtcbiAgcGF0Y2hOZ0hvc3QoXG4gICAgbmdIb3N0LFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICByb290RGlycyxcbiAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICBiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMsXG4gICAgISF1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICApO1xuXG4gIG5nSG9zdC50b1N1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSA9PlxuICAgIHBhdGgucG9zaXguam9pbihcbiAgICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLFxuICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVOYW1lLCByb290RGlycykucmVwbGFjZShFWFQsICcnKSxcbiAgICApO1xuICBpZiAoYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsKSB7XG4gICAgLy8gTm90ZTogVGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gd291bGQgd29yayBhcyB3ZWxsLFxuICAgIC8vIGJ1dCB3ZSBjYW4gYmUgZmFzdGVyIGFzIHdlIGtub3cgaG93IGB0b1N1bW1hcnlGaWxlTmFtZWAgd29ya3MuXG4gICAgLy8gTm90ZTogV2UgY2FuJ3QgZG8gdGhpcyBpZiBzb21lIGRlcHMgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggdGhlIGNvbW1hbmQgbGluZSxcbiAgICAvLyBhcyB0aGF0IGhhcyBhIGRpZmZlcmVudCBpbXBsZW1lbnRhdGlvbiBvZiBmcm9tU3VtbWFyeUZpbGVOYW1lIC8gdG9TdW1tYXJ5RmlsZU5hbWVcbiAgICBuZ0hvc3QuZnJvbVN1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdMaWJGaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSZWxhdGl2ZSA9IGZpbGVOYW1lLnNwbGl0KCcvJykuc3BsaWNlKDEpLmpvaW4oJy8nKTtcbiAgICAgIHJldHVybiB0c2N3LnJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcihcIkNoZWNrIHRoYXQgaXQncyBpbmNsdWRlZCBpbiB0aGUgYGFzc2V0c2AgYXR0cmlidXRlIG9mIHRoZSBgbmdfbW9kdWxlYCBydWxlLlxcblwiKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IG5nLlRzRW1pdENhbGxiYWNrPHRzLkVtaXRSZXN1bHQ+ID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgcHJvZ3JhbS5lbWl0KFxuICAgICAgdGFyZ2V0U291cmNlRmlsZSxcbiAgICAgIHdyaXRlRmlsZSxcbiAgICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgICAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgICAgIGN1c3RvbVRyYW5zZm9ybWVycyxcbiAgICApO1xuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtKTtcbiAgfVxuICBjb25zdCB7ZGlhZ25vc3RpY3MsIGVtaXRSZXN1bHQsIHByb2dyYW19ID0gbmcucGVyZm9ybUNvbXBpbGF0aW9uKHtcbiAgICByb290TmFtZXM6IGZpbGVzLFxuICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0cyxcbiAgICBob3N0OiBuZ0hvc3QsXG4gICAgZW1pdENhbGxiYWNrLFxuICAgIGdhdGhlckRpYWdub3N0aWNzLFxuICB9KTtcbiAgbGV0IGV4dGVybnMgPSAnLyoqIEBleHRlcm5zICovXFxuJztcbiAgY29uc3QgaGFzRXJyb3IgPSBkaWFnbm9zdGljcy5zb21lKChkaWFnKSA9PiBkaWFnLmNhdGVnb3J5ID09PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xuICBpZiAoIWhhc0Vycm9yKSB7XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMubWFuaWZlc3QsICcvLyBFbXB0eS4gU2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCkge1xuICAgIC8vIE5vdGU6IHdoZW4gdHNpY2tsZUV4dGVybnNQYXRoIGlzIHByb3ZpZGVkLCB3ZSBhbHdheXMgd3JpdGUgYSBmaWxlIGFzIGFcbiAgICAvLyBtYXJrZXIgdGhhdCBjb21waWxhdGlvbiBzdWNjZWVkZWQsIGV2ZW4gaWYgaXQncyBlbXB0eSAoanVzdCBjb250YWluaW5nIGFuXG4gICAgLy8gQGV4dGVybnMpLlxuICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCwgZXh0ZXJucyk7XG4gIH1cblxuICAvLyBUaGVyZSBtaWdodCBiZSBzb21lIGV4cGVjdGVkIG91dHB1dCBmaWxlcyB0aGF0IGFyZSBub3Qgd3JpdHRlbiBieSB0aGVcbiAgLy8gY29tcGlsZXIuIEluIHRoaXMgY2FzZSwganVzdCB3cml0ZSBhbiBlbXB0eSBmaWxlLlxuICBmb3IgKGNvbnN0IGZpbGVOYW1lIG9mIGV4cGVjdGVkT3V0c1NldCkge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCAnJywgZmFsc2UpO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMubm9FbWl0KSB7XG4gICAgbWF5YmVXcml0ZVVudXNlZElucHV0c0xpc3QocHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSwgcm9vdERpciwgYmF6ZWxPcHRzKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG4vKipcbiAqIFdyaXRlcyBhIGNvbGxlY3Rpb24gb2YgdW51c2VkIGlucHV0IGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aGljaCBjYW4gYmVcbiAqIGNvbnN1bWVkIGJ5IGJhemVsIHRvIGF2b2lkIHRyaWdnZXJpbmcgcmVidWlsZHMgaWYgb25seSB1bnVzZWQgaW5wdXRzIGFyZVxuICogY2hhbmdlZC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9iYXplbC5idWlsZC9jb250cmlidXRlL2NvZGViYXNlI2lucHV0LWRpc2NvdmVyeVxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVXcml0ZVVudXNlZElucHV0c0xpc3QoXG4gIHByb2dyYW06IHRzLlByb2dyYW0sXG4gIHJvb3REaXI6IHN0cmluZyxcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4pIHtcbiAgaWYgKCFiYXplbE9wdHM/LnVudXNlZElucHV0c0xpc3RQYXRoKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChiYXplbE9wdHMuYWxsb3dlZElucHV0cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdgdW51c2VkSW5wdXRzTGlzdFBhdGhgIGlzIHNldCwgYnV0IG5vIGxpc3Qgb2YgYWxsb3dlZCBpbnB1dHMgcHJvdmlkZWQuJyk7XG4gIH1cblxuICAvLyB0cy5Qcm9ncmFtJ3MgZ2V0U291cmNlRmlsZXMoKSBnZXRzIHBvcHVsYXRlZCBieSB0aGUgc291cmNlcyBhY3R1YWxseVxuICAvLyBsb2FkZWQgd2hpbGUgdGhlIHByb2dyYW0gaXMgYmVpbmcgYnVpbHQuXG4gIGNvbnN0IHVzZWRGaWxlcyA9IG5ldyBTZXQoKTtcbiAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgIC8vIE9ubHkgY29uY2VybiBvdXJzZWx2ZXMgd2l0aCB0eXBlc2NyaXB0IGZpbGVzLlxuICAgIHVzZWRGaWxlcy5hZGQoc291cmNlRmlsZS5maWxlTmFtZSk7XG4gIH1cblxuICAvLyBhbGxvd2VkSW5wdXRzIGFyZSBhYnNvbHV0ZSBwYXRocyB0byBmaWxlcyB3aGljaCBtYXkgYWxzbyBlbmQgd2l0aCAvKiB3aGljaFxuICAvLyBpbXBsaWVzIGFueSBmaWxlcyBpbiB0aGF0IGRpcmVjdG9yeSBjYW4gYmUgdXNlZC5cbiAgY29uc3QgdW51c2VkSW5wdXRzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGYgb2YgYmF6ZWxPcHRzLmFsbG93ZWRJbnB1dHMpIHtcbiAgICAvLyBBIHRzL3ggZmlsZSBpcyB1bnVzZWQgaWYgaXQgd2FzIG5vdCBmb3VuZCBkaXJlY3RseSBpbiB0aGUgdXNlZCBzb3VyY2VzLlxuICAgIGlmICgoZi5lbmRzV2l0aCgnLnRzJykgfHwgZi5lbmRzV2l0aCgnLnRzeCcpKSAmJiAhdXNlZEZpbGVzLmhhcyhmKSkge1xuICAgICAgdW51c2VkSW5wdXRzLnB1c2goZik7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBJdGVyYXRlIG92ZXIgY29udGVudHMgb2YgYWxsb3dlZCBkaXJlY3RvcmllcyBjaGVja2luZyBmb3IgdXNlZCBmaWxlcy5cbiAgfVxuXG4gIC8vIEJhemVsIGV4cGVjdHMgdGhlIHVudXNlZCBpbnB1dCBsaXN0IHRvIGNvbnRhaW4gcGF0aHMgcmVsYXRpdmUgdG8gdGhlXG4gIC8vIGV4ZWNyb290IGRpcmVjdG9yeS5cbiAgLy8gU2VlIGh0dHBzOi8vZG9jcy5iYXplbC5idWlsZC92ZXJzaW9ucy9tYWluL291dHB1dF9kaXJlY3Rvcmllcy5odG1sXG4gIGZzLndyaXRlRmlsZVN5bmMoXG4gICAgYmF6ZWxPcHRzLnVudXNlZElucHV0c0xpc3RQYXRoLFxuICAgIHVudXNlZElucHV0cy5tYXAoKGYpID0+IHBhdGgucmVsYXRpdmUocm9vdERpciwgZikpLmpvaW4oJ1xcbicpLFxuICApO1xufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluZGV4T2Yoc2YuZmlsZU5hbWUpICE9PSAtMTtcbn1cblxuZnVuY3Rpb24gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZpbGVQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICBvcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMsXG4gIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICBuZ1Byb2dyYW06IG5nLlByb2dyYW0sXG4pOiB0cy5EaWFnbm9zdGljW10ge1xuICBjb25zdCB0c1Byb2dyYW0gPSBuZ1Byb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG5cbiAgLy8gRm9yIHRoZSBJdnkgY29tcGlsZXIsIHRyYWNrIHRoZSBhbW91bnQgb2YgdGltZSBzcGVudCBmZXRjaGluZyBUeXBlU2NyaXB0IGRpYWdub3N0aWNzLlxuICBsZXQgcHJldmlvdXNQaGFzZSA9IFBlcmZQaGFzZS5VbmFjY291bnRlZDtcbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIHByZXZpb3VzUGhhc2UgPSBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKFBlcmZQaGFzZS5UeXBlU2NyaXB0RGlhZ25vc3RpY3MpO1xuICB9XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoKGYpID0+IGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzLCBmKSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvZ3JhbUZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgc2YgPSBwcm9ncmFtRmlsZXNbaV07XG4gICAgLy8gTm90ZTogV2Ugb25seSBnZXQgdGhlIGRpYWdub3N0aWNzIGZvciBpbmRpdmlkdWFsIGZpbGVzXG4gICAgLy8gdG8gZS5nLiBub3QgY2hlY2sgbGlicmFyaWVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNmKSk7XG5cbiAgICAvLyBJbiBsb2NhbCBtb2RlIGNvbXBpbGF0aW9uIHRoZSBUUyBzZW1hbnRpYyBjaGVjayBpc3N1ZXMgdG9ucyBvZiBkaWFnbm9zdGljcyBkdWUgdG8gdGhlIGZhY3RcbiAgICAvLyB0aGF0IHRoZSBmaWxlIGRlcGVuZGVuY2llcyAoLmQudHMgZmlsZXMpIGFyZSBub3QgYXZhaWxhYmxlIGluIHRoZSBwcm9ncmFtLiBTbyBpdCBuZWVkcyB0byBiZVxuICAgIC8vIGRpc2FibGVkLlxuICAgIGlmIChvcHRpb25zLmNvbXBpbGF0aW9uTW9kZSAhPT0gJ2V4cGVyaW1lbnRhbC1sb2NhbCcpIHtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICB9XG4gIH1cblxuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShwcmV2aW91c1BoYXNlKTtcbiAgfVxuXG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgLy8gb25seSBnYXRoZXIgdGhlIGFuZ3VsYXIgZGlhZ25vc3RpY3MgaWYgd2UgaGF2ZSBubyBkaWFnbm9zdGljc1xuICAgIC8vIGluIGFueSBvdGhlciBmaWxlcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKiBLZXB0IGhlcmUganVzdCBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIDFQIHRvb2xzLiBUbyBiZSByZW1vdmVkIHNvb24gYWZ0ZXIgMVAgdXBkYXRlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gIG5nSG9zdDogbmcuQ29tcGlsZXJIb3N0LFxuICBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gIHJvb3REaXJzOiBzdHJpbmdbXSxcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogYm9vbGVhbixcbik6IHZvaWQge1xuICBwYXRjaE5nSG9zdChcbiAgICBuZ0hvc3QsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHJvb3REaXJzLFxuICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLFxuICAgIGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYyxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICApO1xufVxuIl19