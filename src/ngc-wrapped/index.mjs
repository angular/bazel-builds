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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0ZBQXNGO0FBQ3RGLE9BQU8sS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sSUFBSSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUU1QixPQUFPLEVBQUMsR0FBRyxFQUFFLG1DQUFtQyxJQUFJLFdBQVcsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVFwRywyRUFBMkU7QUFDM0UsbUJBQW1CO0FBQ25CLE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQztBQUVuQyxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztBQUVwRCw0RUFBNEU7QUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7QUFFM0MsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsSUFBYztJQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUMzQixNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDeEMsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLENBQUMsTUFBTSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELHVEQUF1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UUFDaEUsc0JBQXNCO1FBQ3RCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQzVELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFDRCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLG1DQUFtQyxDQUNqRCxNQUF1QixFQUN2QixZQUFnQyxFQUNoQyxTQUF1QixFQUN2QixRQUFrQixFQUNsQiw0QkFBcUM7SUFFckMsV0FBVyxDQUNULE1BQU0sRUFDTixZQUFZLEVBQ1osUUFBUSxFQUNSLFNBQVMsQ0FBQyxhQUFhLEVBQ3ZCLFNBQVMsQ0FBQyxvQkFBb0IsRUFDOUIsNEJBQTRCLENBQzdCLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vIGB0c2Mtd3JhcHBlZGAgaGVscGVycyBhcmUgbm90IGV4cG9zZWQgaW4gdGhlIHByaW1hcnkgYEBiYXplbC9jb25jYXRqc2AgZW50cnktcG9pbnQuXG5pbXBvcnQgKiBhcyBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtQZXJmUGhhc2V9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9wcml2YXRlL2JhemVsJztcbmltcG9ydCB0c2N3IGZyb20gJ0BiYXplbC9jb25jYXRqcy9pbnRlcm5hbC90c2Nfd3JhcHBlZC9pbmRleC5qcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0VYVCwgcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUgYXMgcGF0Y2hOZ0hvc3QsIHJlbGF0aXZlVG9Sb290RGlyc30gZnJvbSAnLi91dGlscyc7XG5cbi8vIEFkZCBkZXZtb2RlIGZvciBibGF6ZSBpbnRlcm5hbFxuaW50ZXJmYWNlIEJhemVsT3B0aW9ucyBleHRlbmRzIHRzY3cuQmF6ZWxPcHRpb25zIHtcbiAgYWxsb3dlZElucHV0cz86IHN0cmluZ1tdO1xuICB1bnVzZWRJbnB1dHNMaXN0UGF0aD86IHN0cmluZztcbn1cblxuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbCkkLztcblxuY29uc3QgQkFaRUxfQklOID0gL1xcYihibGF6ZXxiYXplbCktb3V0XFxiLio/XFxiYmluXFxiLztcblxuLy8gTm90ZTogV2UgY29tcGlsZSB0aGUgY29udGVudCBvZiBub2RlX21vZHVsZXMgd2l0aCBwbGFpbiBuZ2MgY29tbWFuZCBsaW5lLlxuY29uc3QgQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCA9IGZhbHNlO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihhcmdzOiBzdHJpbmdbXSkge1xuICBpZiAodHNjdy5ydW5Bc1dvcmtlcihhcmdzKSkge1xuICAgIGF3YWl0IHRzY3cucnVuV29ya2VyTG9vcChydW5PbmVCdWlsZCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIChhd2FpdCBydW5PbmVCdWlsZChhcmdzKSkgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IHRzY3cuRmlsZUNhY2hlPHRzLlNvdXJjZUZpbGU+KHRzY3cuZGVidWcpO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuT25lQnVpbGQoXG4gIGFyZ3M6IHN0cmluZ1tdLFxuICBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgaWYgKGFyZ3NbMF0gPT09ICctcCcpIHtcbiAgICBhcmdzLnNoaWZ0KCk7XG4gIH1cblxuICAvLyBTdHJpcCBsZWFkaW5nIGF0LXNpZ25zLCB1c2VkIHRvIGluZGljYXRlIGEgcGFyYW1zIGZpbGVcbiAgY29uc3QgcHJvamVjdCA9IGFyZ3NbMF0ucmVwbGFjZSgvXkArLywgJycpO1xuXG4gIGNvbnN0IFtwYXJzZWRPcHRpb25zLCBlcnJvcnNdID0gdHNjdy5wYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAocGFyc2VkT3B0aW9ucyA9PT0gbnVsbCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBwYXJzZSB0c2NvbmZpZy4gTm8gcGFyc2UgZGlhZ25vc3RpY3MgcHJvdmlkZWQuJyk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3Qge2JhemVsT3B0cywgb3B0aW9uczogdHNPcHRpb25zLCBmaWxlcywgY29uZmlnfSA9IHBhcnNlZE9wdGlvbnM7XG4gIGNvbnN0IHtlcnJvcnM6IHVzZXJFcnJvcnMsIG9wdGlvbnM6IHVzZXJPcHRpb25zfSA9IG5nLnJlYWRDb25maWd1cmF0aW9uKHByb2plY3QpO1xuXG4gIGlmICh1c2VyRXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKHVzZXJFcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMgPSBuZXcgU2V0PHN0cmluZz4oW1xuICAgICdkaWFnbm9zdGljcycsXG4gICAgJ3RyYWNlJyxcbiAgICAnZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZycsXG4gICAgJ2Rpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrJyxcbiAgICAnaTE4bk91dExvY2FsZScsXG4gICAgJ2kxOG5PdXRGb3JtYXQnLFxuICAgICdpMThuT3V0RmlsZScsXG4gICAgJ2kxOG5JbkxvY2FsZScsXG4gICAgJ2kxOG5JbkZpbGUnLFxuICAgICdpMThuSW5Gb3JtYXQnLFxuICAgICdpMThuVXNlRXh0ZXJuYWxJZHMnLFxuICAgICdpMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zJyxcbiAgICAncHJlc2VydmVXaGl0ZXNwYWNlcycsXG4gICAgJ2NyZWF0ZUV4dGVybmFsU3ltYm9sRmFjdG9yeVJlZXhwb3J0cycsXG4gICAgJ2V4dGVuZGVkRGlhZ25vc3RpY3MnLFxuICAgICdmb3JiaWRPcnBoYW5Db21wb25lbnRzJyxcbiAgICAnb25seUV4cGxpY2l0RGVmZXJEZXBlbmRlbmN5SW1wb3J0cycsXG4gIF0pO1xuXG4gIGNvbnN0IHVzZXJPdmVycmlkZXMgPSBPYmplY3QuZW50cmllcyh1c2VyT3B0aW9ucylcbiAgICAuZmlsdGVyKChba2V5XSkgPT4gYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzLmhhcyhrZXkpKVxuICAgIC5yZWR1Y2UoXG4gICAgICAob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcblxuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgfSxcbiAgICAgIHt9IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgICk7XG5cbiAgLy8gQW5ndWxhciBDb21waWxlciBvcHRpb25zIGFyZSBhbHdheXMgc2V0IHVuZGVyIEJhemVsLiBTZWUgYG5nX21vZHVsZS5iemxgLlxuICBjb25zdCBhbmd1bGFyQ29uZmlnUmF3T3B0aW9ucyA9IChjb25maWcgYXMge2FuZ3VsYXJDb21waWxlck9wdGlvbnM6IG5nLkFuZ3VsYXJDb21waWxlck9wdGlvbnN9KVtcbiAgICAnYW5ndWxhckNvbXBpbGVyT3B0aW9ucydcbiAgXTtcblxuICBjb25zdCBjb21waWxlck9wdHM6IG5nLkFuZ3VsYXJDb21waWxlck9wdGlvbnMgPSB7XG4gICAgLi4udXNlck92ZXJyaWRlcyxcbiAgICAuLi5hbmd1bGFyQ29uZmlnUmF3T3B0aW9ucyxcbiAgICAuLi50c09wdGlvbnMsXG4gIH07XG5cbiAgLy8gVGhlc2UgYXJlIG9wdGlvbnMgcGFzc2VkIHRocm91Z2ggZnJvbSB0aGUgYG5nX21vZHVsZWAgcnVsZSB3aGljaCBhcmVuJ3Qgc3VwcG9ydGVkXG4gIC8vIGJ5IHRoZSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCBhbmQgYXJlIG9ubHkgaW50ZW5kZWQgZm9yIGBuZ2Mtd3JhcHBlZGAuXG4gIGNvbnN0IHtleHBlY3RlZE91dCwgX3VzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWV9ID0gYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnM7XG5cbiAgY29uc3QgdHNIb3N0ID0gdHMuY3JlYXRlQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0cywgdHJ1ZSk7XG4gIGNvbnN0IHtkaWFnbm9zdGljc30gPSBjb21waWxlKHtcbiAgICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw6IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwsXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogX3VzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gICAgZXhwZWN0ZWRPdXRzOiBleHBlY3RlZE91dCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgdHNIb3N0LFxuICAgIGJhemVsT3B0cyxcbiAgICBmaWxlcyxcbiAgICBpbnB1dHMsXG4gIH0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcykpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcy5ldmVyeSgoZCkgPT4gZC5jYXRlZ29yeSAhPT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGUoe1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwgPSB0cnVlLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICBjb21waWxlck9wdHMsXG4gIHRzSG9zdCxcbiAgYmF6ZWxPcHRzLFxuICBmaWxlcyxcbiAgaW5wdXRzLFxuICBleHBlY3RlZE91dHMsXG4gIGdhdGhlckRpYWdub3N0aWNzLFxuICBiYXplbEhvc3QsXG59OiB7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbD86IGJvb2xlYW47XG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU/OiBib29sZWFuO1xuICBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgdHNIb3N0OiB0cy5Db21waWxlckhvc3Q7XG4gIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfTtcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnM7XG4gIGZpbGVzOiBzdHJpbmdbXTtcbiAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXTtcbiAgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogbmcuUHJvZ3JhbSkgPT4gcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdO1xuICBiYXplbEhvc3Q/OiB0c2N3LkNvbXBpbGVySG9zdDtcbn0pOiB7ZGlhZ25vc3RpY3M6IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXTsgcHJvZ3JhbTogbmcuUHJvZ3JhbSB8IHVuZGVmaW5lZH0ge1xuICBsZXQgZmlsZUxvYWRlcjogdHNjdy5GaWxlTG9hZGVyO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHNldCBpbiBCYXplbC4gU2VlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9ydWxlc19ub2RlanMvYmxvYi81OTFlNzZlZGM5ZWUwYTcxZDYwNGM1OTk5YWY4YmFkNzkwOWVmMmQ0L3BhY2thZ2VzL2NvbmNhdGpzL2ludGVybmFsL2NvbW1vbi90c2NvbmZpZy5iemwjTDI0Ni5cbiAgY29uc3QgYmFzZVVybCA9IGNvbXBpbGVyT3B0cy5iYXNlVXJsITtcbiAgY29uc3Qgcm9vdERpciA9IGNvbXBpbGVyT3B0cy5yb290RGlyITtcbiAgY29uc3Qgcm9vdERpcnMgPSBjb21waWxlck9wdHMucm9vdERpcnMhO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgdHNjdy5DYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzLnNldCh0c2N3LnJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyB0c2N3LlVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IGZyb20gY29tcGlsZXJPcHRzIHdoZXRoZXIgdGhlIGVudHJ5cG9pbnQgaXMgYmVpbmcgaW52b2tlZCBpbiBJdnkgbW9kZS5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZCgocm9vdERpcikgPT4gQkFaRUxfQklOLnRlc3Qocm9vdERpcikpO1xuICBpZiAoIWJhemVsQmluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGJhemVsIGJpbiBpbiB0aGUgcm9vdERpcnM6ICR7Y29tcGlsZXJPcHRzLnJvb3REaXJzfWApO1xuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRPdXRzU2V0ID0gbmV3IFNldChleHBlY3RlZE91dHMubWFwKChwKSA9PiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKHApKSk7XG5cbiAgY29uc3Qgb3JpZ2luYWxXcml0ZUZpbGUgPSB0c0hvc3Qud3JpdGVGaWxlLmJpbmQodHNIb3N0KTtcbiAgdHNIb3N0LndyaXRlRmlsZSA9IChcbiAgICBmaWxlTmFtZTogc3RyaW5nLFxuICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICB3cml0ZUJ5dGVPcmRlck1hcms6IGJvb2xlYW4sXG4gICAgb25FcnJvcj86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQsXG4gICAgc291cmNlRmlsZXM/OiByZWFkb25seSB0cy5Tb3VyY2VGaWxlW10sXG4gICkgPT4ge1xuICAgIGNvbnN0IHJlbGF0aXZlID0gcmVsYXRpdmVUb1Jvb3REaXJzKGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZU5hbWUpLCBbcm9vdERpcl0pO1xuICAgIGlmIChleHBlY3RlZE91dHNTZXQuaGFzKHJlbGF0aXZlKSkge1xuICAgICAgZXhwZWN0ZWRPdXRzU2V0LmRlbGV0ZShyZWxhdGl2ZSk7XG4gICAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgY29udGVudCwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgfVxuICB9O1xuXG4gIGlmICghYmF6ZWxIb3N0KSB7XG4gICAgYmF6ZWxIb3N0ID0gbmV3IHRzY3cuQ29tcGlsZXJIb3N0KGZpbGVzLCBjb21waWxlck9wdHMsIGJhemVsT3B0cywgdHNIb3N0LCBmaWxlTG9hZGVyKTtcbiAgfVxuXG4gIGNvbnN0IGRlbGVnYXRlID0gYmF6ZWxIb3N0LnNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZy5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIC8vIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIHNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZyBjaGVja3Mgd2hldGhlciBgZmlsZU5hbWVgIGlzIHBhcnQgb2ZcbiAgICAvLyB0aGUgb3JpZ2luYWwgYHNyY3NbXWAuIEZvciBBbmd1bGFyIChJdnkpIGNvbXBpbGF0aW9ucywgbmdmYWN0b3J5L25nc3VtbWFyeSBmaWxlcyB0aGF0IGFyZVxuICAgIC8vIHNoaW1zIGZvciBvcmlnaW5hbCAudHMgZmlsZXMgaW4gdGhlIHByb2dyYW0gc2hvdWxkIGJlIHRyZWF0ZWQgaWRlbnRpY2FsbHkuIFRodXMsIHN0cmlwIHRoZVxuICAgIC8vICcubmdmYWN0b3J5JyBvciAnLm5nc3VtbWFyeScgcGFydCBvZiB0aGUgZmlsZW5hbWUgYXdheSBiZWZvcmUgY2FsbGluZyB0aGUgZGVsZWdhdGUuXG4gICAgcmV0dXJuIGRlbGVnYXRlKGZpbGVOYW1lLnJlcGxhY2UoL1xcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5KVxcLnRzJC8sICcudHMnKSk7XG4gIH07XG5cbiAgLy8gTmV2ZXIgcnVuIHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0uXG4gIC8vIFRPRE8oYi8yNTQwNTQxMDMpOiBSZW1vdmUgdGhlIHRyYW5zZm9ybSBhbmQgdGhpcyBmbGFnLlxuICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuXG4gIC8vIEJ5IGRlZmF1bHQgaW4gdGhlIGBwcm9kbW9kZWAgb3V0cHV0LCB3ZSBkbyBub3QgYWRkIGFubm90YXRpb25zIGZvciBjbG9zdXJlIGNvbXBpbGVyLlxuICAvLyBUaG91Z2gsIGlmIHdlIGFyZSBidWlsZGluZyBpbnNpZGUgYGdvb2dsZTNgLCBjbG9zdXJlIGFubm90YXRpb25zIGFyZSBkZXNpcmVkIGZvclxuICAvLyBwcm9kbW9kZSBvdXRwdXQsIHNvIHdlIGVuYWJsZSBpdCBieSBkZWZhdWx0LiBUaGUgZGVmYXVsdHMgY2FuIGJlIG92ZXJyaWRkZW4gYnlcbiAgLy8gc2V0dGluZyB0aGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBjb21waWxlciBvcHRpb24gaW4gdGhlIHVzZXIgdHNjb25maWcuXG4gIGlmICghYmF6ZWxPcHRzLmVzNU1vZGUgJiYgIWJhemVsT3B0cy5kZXZtb2RlKSB7XG4gICAgaWYgKGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lID09PSAnZ29vZ2xlMycpIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIEFuZ3VsYXIgY29tcGlsZXIgb3B0aW9uIGlzIG5vdCByZXNwZWN0ZWQgYnkgZGVmYXVsdFxuICAvLyBhcyBuZ2Mtd3JhcHBlZCBoYW5kbGVzIHRzaWNrbGUgZW1pdCBvbiBpdHMgb3duLiBUaGlzIG1lYW5zIHRoYXQgd2UgbmVlZCB0byB1cGRhdGVcbiAgLy8gdGhlIHRzaWNrbGUgY29tcGlsZXIgaG9zdCBiYXNlZCBvbiB0aGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBmbGFnLlxuICBpZiAoY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSB7XG4gICAgYmF6ZWxIb3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFBhdGNoIGZpbGVFeGlzdHMgd2hlbiByZXNvbHZpbmcgbW9kdWxlcywgc28gdGhhdCBDb21waWxlckhvc3QgY2FuIGFzayBUeXBlU2NyaXB0IHRvXG4gIC8vIHJlc29sdmUgbm9uLWV4aXN0aW5nIGdlbmVyYXRlZCBmaWxlcyB0aGF0IGRvbid0IGV4aXN0IG9uIGRpc2ssIGJ1dCBhcmVcbiAgLy8gc3ludGhldGljIGFuZCBhZGRlZCB0byB0aGUgYHByb2dyYW1XaXRoU3R1YnNgIGJhc2VkIG9uIHJlYWwgaW5wdXRzLlxuICBjb25zdCBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0ID0gYmF6ZWxIb3N0LmZpbGVFeGlzdHM7XG4gIGJhemVsSG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoTkdDX0FTU0VUUy50ZXN0KGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RGaWxlRXhpc3QuY2FsbChiYXplbEhvc3QsIGZpbGVOYW1lKTtcbiAgfTtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUgPSBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZS5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBmbGF0TW9kdWxlT3V0UGF0aCA9IHBhdGgucG9zaXguam9pbihcbiAgICAgIGJhemVsT3B0cy5wYWNrYWdlLFxuICAgICAgY29tcGlsZXJPcHRzLmZsYXRNb2R1bGVPdXRGaWxlICsgJy50cycsXG4gICAgKTtcblxuICAgIC8vIFRoZSBidW5kbGUgaW5kZXggZmlsZSBpcyBzeW50aGVzaXplZCBpbiBidW5kbGVfaW5kZXhfaG9zdCBzbyBpdCdzIG5vdCBpbiB0aGVcbiAgICAvLyBjb21waWxhdGlvblRhcmdldFNyYy5cbiAgICAvLyBIb3dldmVyIHdlIHN0aWxsIHdhbnQgdG8gZ2l2ZSBpdCBhbiBBTUQgbW9kdWxlIG5hbWUgZm9yIGRldm1vZGUuXG4gICAgLy8gV2UgY2FuJ3QgZWFzaWx5IHRlbGwgd2hpY2ggZmlsZSBpcyB0aGUgc3ludGhldGljIG9uZSwgc28gd2UgYnVpbGQgdXAgdGhlIHBhdGggd2UgZXhwZWN0XG4gICAgLy8gaXQgdG8gaGF2ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oYmFzZVVybCwgZmxhdE1vZHVsZU91dFBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEFsc28gaGFuZGxlIHRoZSBjYXNlIHRoZSB0YXJnZXQgaXMgaW4gYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeS5cbiAgICAvLyBQdWxsIHRoZSB3b3Jrc3BhY2UgbmFtZSBmcm9tIHRoZSB0YXJnZXQgd2hpY2ggaXMgZm9ybWF0dGVkIGFzIGBAd2tzcC8vcGFja2FnZTp0YXJnZXRgXG4gICAgLy8gaWYgaXQgdGhlIHRhcmdldCBpcyBmcm9tIGFuIGV4dGVybmFsIHdvcmtzcGFjZS4gSWYgdGhlIHRhcmdldCBpcyBmcm9tIHRoZSBsb2NhbFxuICAgIC8vIHdvcmtzcGFjZSB0aGVuIGl0IHdpbGwgYmUgZm9ybWF0dGVkIGFzIGAvL3BhY2thZ2U6dGFyZ2V0YC5cbiAgICBjb25zdCB0YXJnZXRXb3Jrc3BhY2UgPSBiYXplbE9wdHMudGFyZ2V0LnNwbGl0KCcvJylbMF0ucmVwbGFjZSgvXkAvLCAnJyk7XG5cbiAgICBpZiAoXG4gICAgICB0YXJnZXRXb3Jrc3BhY2UgJiZcbiAgICAgIGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oYmFzZVVybCwgJ2V4dGVybmFsJywgdGFyZ2V0V29ya3NwYWNlLCBmbGF0TW9kdWxlT3V0UGF0aClcbiAgICApXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIHBhdGNoTmdIb3N0KFxuICAgIG5nSG9zdCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgcm9vdERpcnMsXG4gICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLFxuICAgICEhdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgKTtcblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT5cbiAgICBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZSwgcm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyksXG4gICAgKTtcbiAgaWYgKGFsbERlcHNDb21waWxlZFdpdGhCYXplbCkge1xuICAgIC8vIE5vdGU6IFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCxcbiAgICAvLyBidXQgd2UgY2FuIGJlIGZhc3RlciBhcyB3ZSBrbm93IGhvdyBgdG9TdW1tYXJ5RmlsZU5hbWVgIHdvcmtzLlxuICAgIC8vIE5vdGU6IFdlIGNhbid0IGRvIHRoaXMgaWYgc29tZSBkZXBzIGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIHRoZSBjb21tYW5kIGxpbmUsXG4gICAgLy8gYXMgdGhhdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgZnJvbVN1bW1hcnlGaWxlTmFtZSAvIHRvU3VtbWFyeUZpbGVOYW1lXG4gICAgbmdIb3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBmaWxlTmFtZS5zcGxpdCgnLycpLnNwbGljZSgxKS5qb2luKCcvJyk7XG4gICAgICByZXR1cm4gdHNjdy5yZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHdvcmtzcGFjZVJlbGF0aXZlKSArICcuZC50cyc7XG4gICAgfTtcbiAgfVxuICAvLyBQYXRjaCBhIHByb3BlcnR5IG9uIHRoZSBuZ0hvc3QgdGhhdCBhbGxvd3MgdGhlIHJlc291cmNlTmFtZVRvTW9kdWxlTmFtZSBmdW5jdGlvbiB0b1xuICAvLyByZXBvcnQgYmV0dGVyIGVycm9ycy5cbiAgKG5nSG9zdCBhcyBhbnkpLnJlcG9ydE1pc3NpbmdSZXNvdXJjZSA9IChyZXNvdXJjZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxcbkFzc2V0IG5vdCBmb3VuZDpcXG4gICR7cmVzb3VyY2VOYW1lfWApO1xuICAgIGNvbnNvbGUuZXJyb3IoXCJDaGVjayB0aGF0IGl0J3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG5cIik7XG4gIH07XG5cbiAgY29uc3QgZW1pdENhbGxiYWNrOiBuZy5Uc0VtaXRDYWxsYmFjazx0cy5FbWl0UmVzdWx0PiA9ICh7XG4gICAgcHJvZ3JhbSxcbiAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgIHdyaXRlRmlsZSxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICB9KSA9PlxuICAgIHByb2dyYW0uZW1pdChcbiAgICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgICB3cml0ZUZpbGUsXG4gICAgICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgICBjdXN0b21UcmFuc2Zvcm1lcnMsXG4gICAgKTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShjb21waWxlck9wdHMsIGJhemVsT3B0cywgcHJvZ3JhbSk7XG4gIH1cbiAgY29uc3Qge2RpYWdub3N0aWNzLCBlbWl0UmVzdWx0LCBwcm9ncmFtfSA9IG5nLnBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgcm9vdE5hbWVzOiBmaWxlcyxcbiAgICBvcHRpb25zOiBjb21waWxlck9wdHMsXG4gICAgaG9zdDogbmdIb3N0LFxuICAgIGVtaXRDYWxsYmFjayxcbiAgICBnYXRoZXJEaWFnbm9zdGljcyxcbiAgfSk7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGNvbnN0IGhhc0Vycm9yID0gZGlhZ25vc3RpY3Muc29tZSgoZGlhZykgPT4gZGlhZy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbiAgaWYgKCFoYXNFcnJvcikge1xuICAgIGlmIChiYXplbE9wdHMubWFuaWZlc3QpIHtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLm1hbmlmZXN0LCAnLy8gRW1wdHkuIFNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBjb21waWxhdGlvbiBmYWlscyB1bmV4cGVjdGVkbHksIHBlcmZvcm1Db21waWxhdGlvbiByZXR1cm5zIG5vIHByb2dyYW0uXG4gIC8vIE1ha2Ugc3VyZSBub3QgdG8gY3Jhc2ggYnV0IHJlcG9ydCB0aGUgZGlhZ25vc3RpY3MuXG4gIGlmICghcHJvZ3JhbSkgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG5cbiAgaWYgKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgpIHtcbiAgICAvLyBOb3RlOiB3aGVuIHRzaWNrbGVFeHRlcm5zUGF0aCBpcyBwcm92aWRlZCwgd2UgYWx3YXlzIHdyaXRlIGEgZmlsZSBhcyBhXG4gICAgLy8gbWFya2VyIHRoYXQgY29tcGlsYXRpb24gc3VjY2VlZGVkLCBldmVuIGlmIGl0J3MgZW1wdHkgKGp1c3QgY29udGFpbmluZyBhblxuICAgIC8vIEBleHRlcm5zKS5cbiAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgsIGV4dGVybnMpO1xuICB9XG5cbiAgLy8gVGhlcmUgbWlnaHQgYmUgc29tZSBleHBlY3RlZCBvdXRwdXQgZmlsZXMgdGhhdCBhcmUgbm90IHdyaXR0ZW4gYnkgdGhlXG4gIC8vIGNvbXBpbGVyLiBJbiB0aGlzIGNhc2UsIGp1c3Qgd3JpdGUgYW4gZW1wdHkgZmlsZS5cbiAgZm9yIChjb25zdCBmaWxlTmFtZSBvZiBleHBlY3RlZE91dHNTZXQpIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgJycsIGZhbHNlKTtcbiAgfVxuXG4gIGlmICghY29tcGlsZXJPcHRzLm5vRW1pdCkge1xuICAgIG1heWJlV3JpdGVVbnVzZWRJbnB1dHNMaXN0KHByb2dyYW0uZ2V0VHNQcm9ncmFtKCksIHJvb3REaXIsIGJhemVsT3B0cyk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBXcml0ZXMgYSBjb2xsZWN0aW9uIG9mIHVudXNlZCBpbnB1dCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgd2hpY2ggY2FuIGJlXG4gKiBjb25zdW1lZCBieSBiYXplbCB0byBhdm9pZCB0cmlnZ2VyaW5nIHJlYnVpbGRzIGlmIG9ubHkgdW51c2VkIGlucHV0cyBhcmVcbiAqIGNoYW5nZWQuXG4gKlxuICogU2VlIGh0dHBzOi8vYmF6ZWwuYnVpbGQvY29udHJpYnV0ZS9jb2RlYmFzZSNpbnB1dC1kaXNjb3ZlcnlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1heWJlV3JpdGVVbnVzZWRJbnB1dHNMaXN0KFxuICBwcm9ncmFtOiB0cy5Qcm9ncmFtLFxuICByb290RGlyOiBzdHJpbmcsXG4gIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuKSB7XG4gIGlmICghYmF6ZWxPcHRzPy51bnVzZWRJbnB1dHNMaXN0UGF0aCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoYmF6ZWxPcHRzLmFsbG93ZWRJbnB1dHMgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYHVudXNlZElucHV0c0xpc3RQYXRoYCBpcyBzZXQsIGJ1dCBubyBsaXN0IG9mIGFsbG93ZWQgaW5wdXRzIHByb3ZpZGVkLicpO1xuICB9XG5cbiAgLy8gdHMuUHJvZ3JhbSdzIGdldFNvdXJjZUZpbGVzKCkgZ2V0cyBwb3B1bGF0ZWQgYnkgdGhlIHNvdXJjZXMgYWN0dWFsbHlcbiAgLy8gbG9hZGVkIHdoaWxlIHRoZSBwcm9ncmFtIGlzIGJlaW5nIGJ1aWx0LlxuICBjb25zdCB1c2VkRmlsZXMgPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBwcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAvLyBPbmx5IGNvbmNlcm4gb3Vyc2VsdmVzIHdpdGggdHlwZXNjcmlwdCBmaWxlcy5cbiAgICB1c2VkRmlsZXMuYWRkKHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICB9XG5cbiAgLy8gYWxsb3dlZElucHV0cyBhcmUgYWJzb2x1dGUgcGF0aHMgdG8gZmlsZXMgd2hpY2ggbWF5IGFsc28gZW5kIHdpdGggLyogd2hpY2hcbiAgLy8gaW1wbGllcyBhbnkgZmlsZXMgaW4gdGhhdCBkaXJlY3RvcnkgY2FuIGJlIHVzZWQuXG4gIGNvbnN0IHVudXNlZElucHV0czogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBmIG9mIGJhemVsT3B0cy5hbGxvd2VkSW5wdXRzKSB7XG4gICAgLy8gQSB0cy94IGZpbGUgaXMgdW51c2VkIGlmIGl0IHdhcyBub3QgZm91bmQgZGlyZWN0bHkgaW4gdGhlIHVzZWQgc291cmNlcy5cbiAgICBpZiAoKGYuZW5kc1dpdGgoJy50cycpIHx8IGYuZW5kc1dpdGgoJy50c3gnKSkgJiYgIXVzZWRGaWxlcy5oYXMoZikpIHtcbiAgICAgIHVudXNlZElucHV0cy5wdXNoKGYpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogSXRlcmF0ZSBvdmVyIGNvbnRlbnRzIG9mIGFsbG93ZWQgZGlyZWN0b3JpZXMgY2hlY2tpbmcgZm9yIHVzZWQgZmlsZXMuXG4gIH1cblxuICAvLyBCYXplbCBleHBlY3RzIHRoZSB1bnVzZWQgaW5wdXQgbGlzdCB0byBjb250YWluIHBhdGhzIHJlbGF0aXZlIHRvIHRoZVxuICAvLyBleGVjcm9vdCBkaXJlY3RvcnkuXG4gIC8vIFNlZSBodHRwczovL2RvY3MuYmF6ZWwuYnVpbGQvdmVyc2lvbnMvbWFpbi9vdXRwdXRfZGlyZWN0b3JpZXMuaHRtbFxuICBmcy53cml0ZUZpbGVTeW5jKFxuICAgIGJhemVsT3B0cy51bnVzZWRJbnB1dHNMaXN0UGF0aCxcbiAgICB1bnVzZWRJbnB1dHMubWFwKChmKSA9PiBwYXRoLnJlbGF0aXZlKHJvb3REaXIsIGYpKS5qb2luKCdcXG4nKSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmRleE9mKHNmLmZpbGVOYW1lKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgb3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zLFxuICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtLFxuKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gIC8vIEZvciB0aGUgSXZ5IGNvbXBpbGVyLCB0cmFjayB0aGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgZmV0Y2hpbmcgVHlwZVNjcmlwdCBkaWFnbm9zdGljcy5cbiAgbGV0IHByZXZpb3VzUGhhc2UgPSBQZXJmUGhhc2UuVW5hY2NvdW50ZWQ7XG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBwcmV2aW91c1BoYXNlID0gbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShQZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzKTtcbiAgfVxuICBjb25zdCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKChmKSA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuXG4gICAgLy8gSW4gbG9jYWwgbW9kZSBjb21waWxhdGlvbiB0aGUgVFMgc2VtYW50aWMgY2hlY2sgaXNzdWVzIHRvbnMgb2YgZGlhZ25vc3RpY3MgZHVlIHRvIHRoZSBmYWN0XG4gICAgLy8gdGhhdCB0aGUgZmlsZSBkZXBlbmRlbmNpZXMgKC5kLnRzIGZpbGVzKSBhcmUgbm90IGF2YWlsYWJsZSBpbiB0aGUgcHJvZ3JhbS4gU28gaXQgbmVlZHMgdG8gYmVcbiAgICAvLyBkaXNhYmxlZC5cbiAgICBpZiAob3B0aW9ucy5jb21waWxhdGlvbk1vZGUgIT09ICdleHBlcmltZW50YWwtbG9jYWwnKSB7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UocHJldmlvdXNQaGFzZSk7XG4gIH1cblxuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIC8vIG9ubHkgZ2F0aGVyIHRoZSBhbmd1bGFyIGRpYWdub3N0aWNzIGlmIHdlIGhhdmUgbm8gZGlhZ25vc3RpY3NcbiAgICAvLyBpbiBhbnkgb3RoZXIgZmlsZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogS2VwdCBoZXJlIGp1c3QgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCAxUCB0b29scy4gVG8gYmUgcmVtb3ZlZCBzb29uIGFmdGVyIDFQIHVwZGF0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICBuZ0hvc3Q6IG5nLkNvbXBpbGVySG9zdCxcbiAgY29tcGlsZXJPcHRzOiBuZy5Db21waWxlck9wdGlvbnMsXG4gIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICByb290RGlyczogc3RyaW5nW10sXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgcGF0Y2hOZ0hvc3QoXG4gICAgbmdIb3N0LFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICByb290RGlycyxcbiAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICBiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMsXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgKTtcbn1cbiJdfQ==