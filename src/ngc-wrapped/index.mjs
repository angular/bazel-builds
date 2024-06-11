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
        '_enableLetSyntax',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsc0ZBQXNGO0FBQ3RGLE9BQU8sS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sSUFBSSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUU1QixPQUFPLEVBQUMsR0FBRyxFQUFFLG1DQUFtQyxJQUFJLFdBQVcsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQVFwRywyRUFBMkU7QUFDM0UsbUJBQW1CO0FBQ25CLE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQztBQUVuQyxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztBQUVwRCw0RUFBNEU7QUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7QUFFM0MsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsSUFBYztJQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUMzQixNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDeEMsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLENBQUMsTUFBTSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELHVEQUF1RDtBQUN2RCxNQUFNLFNBQVMsR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQWdCLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUVoRSxNQUFNLENBQUMsS0FBSyxVQUFVLFdBQVcsQ0FDL0IsSUFBYyxFQUNkLE1BQWlDO0lBRWpDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNmLENBQUM7SUFFRCx5REFBeUQ7SUFDekQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFM0MsTUFBTSxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzVELElBQUksTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ25CLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDNUMsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsSUFBSSxhQUFhLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDM0IsT0FBTyxDQUFDLEtBQUssQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1FBQzFFLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELE1BQU0sRUFBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFDLEdBQUcsYUFBYSxDQUFDO0lBQ3JFLE1BQU0sRUFBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUMsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFakYsSUFBSSxVQUFVLEVBQUUsTUFBTSxFQUFFLENBQUM7UUFDdkIsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNoRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxNQUFNLGlDQUFpQyxHQUFHLElBQUksR0FBRyxDQUFTO1FBQ3hELGFBQWE7UUFDYixPQUFPO1FBQ1AsMkJBQTJCO1FBQzNCLCtCQUErQjtRQUMvQixlQUFlO1FBQ2YsZUFBZTtRQUNmLGFBQWE7UUFDYixjQUFjO1FBQ2QsWUFBWTtRQUNaLGNBQWM7UUFDZCxvQkFBb0I7UUFDcEIsMkJBQTJCO1FBQzNCLHFCQUFxQjtRQUNyQixzQ0FBc0M7UUFDdEMscUJBQXFCO1FBQ3JCLHdCQUF3QjtRQUN4QixvQ0FBb0M7UUFDcEMsaUNBQWlDO1FBQ2pDLGtCQUFrQjtLQUNuQixDQUFDLENBQUM7SUFFSCxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztTQUM5QyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDN0QsTUFBTSxDQUNMLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7UUFDcEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUVqQixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsRUFDRCxFQUE2QixDQUM5QixDQUFDO0lBRUosNEVBQTRFO0lBQzVFLE1BQU0sdUJBQXVCLEdBQUksTUFBOEQsQ0FDN0Ysd0JBQXdCLENBQ3pCLENBQUM7SUFFRixNQUFNLFlBQVksR0FBOEI7UUFDOUMsR0FBRyxhQUFhO1FBQ2hCLEdBQUcsdUJBQXVCO1FBQzFCLEdBQUcsU0FBUztLQUNiLENBQUM7SUFFRixvRkFBb0Y7SUFDcEYsMEVBQTBFO0lBQzFFLE1BQU0sRUFBQyxXQUFXLEVBQUUsNkJBQTZCLEVBQUMsR0FBRyx1QkFBdUIsQ0FBQztJQUU3RSxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pELE1BQU0sRUFBQyxXQUFXLEVBQUMsR0FBRyxPQUFPLENBQUM7UUFDNUIsd0JBQXdCLEVBQUUsNEJBQTRCO1FBQ3RELDRCQUE0QixFQUFFLDZCQUE2QjtRQUMzRCxZQUFZLEVBQUUsV0FBVztRQUN6QixZQUFZO1FBQ1osTUFBTTtRQUNOLFNBQVM7UUFDVCxLQUFLO1FBQ0wsTUFBTTtLQUNQLENBQUMsQ0FBQztJQUNILElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUNELE9BQU8sV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsS0FBSyxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDOUUsQ0FBQztBQUVELE1BQU0sVUFBVSxPQUFPLENBQUMsRUFDdEIsd0JBQXdCLEdBQUcsSUFBSSxFQUMvQiw0QkFBNEIsRUFDNUIsWUFBWSxFQUNaLE1BQU0sRUFDTixTQUFTLEVBQ1QsS0FBSyxFQUNMLE1BQU0sRUFDTixZQUFZLEVBQ1osaUJBQWlCLEVBQ2pCLFNBQVMsR0FZVjtJQUNDLElBQUksVUFBMkIsQ0FBQztJQUVoQyxzREFBc0Q7SUFDdEQsZ0pBQWdKO0lBQ2hKLE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxPQUFRLENBQUM7SUFDdEMsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLE9BQVEsQ0FBQztJQUN0QyxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUyxDQUFDO0lBRXhDLElBQUksU0FBUyxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMzQyxNQUFNLGlCQUFpQixHQUFHLFNBQVMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDL0QsU0FBUyxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQy9DLENBQUM7U0FBTSxDQUFDO1FBQ04sU0FBUyxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQUksTUFBTSxFQUFFLENBQUM7UUFDWCxVQUFVLEdBQUcsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbEQscUVBQXFFO1FBQ3JFLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBQ2pELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMxQyxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNELFNBQVMsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDeEMsQ0FBQztTQUFNLENBQUM7UUFDTixVQUFVLEdBQUcsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUM3QyxDQUFDO0lBRUQsZ0ZBQWdGO0lBQ2hGLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDM0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFDRCxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFdkYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4RCxNQUFNLENBQUMsU0FBUyxHQUFHLENBQ2pCLFFBQWdCLEVBQ2hCLE9BQWUsRUFDZixrQkFBMkIsRUFDM0IsT0FBbUMsRUFDbkMsV0FBc0MsRUFDdEMsRUFBRTtRQUNGLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDLHlCQUF5QixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNwRixJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNsQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7SUFDSCxDQUFDLENBQUM7SUFFRixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDZixTQUFTLEdBQUcsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBRUQsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN2RSxTQUFTLENBQUMsMkJBQTJCLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7UUFDM0QsOEZBQThGO1FBQzlGLDRGQUE0RjtRQUM1Riw2RkFBNkY7UUFDN0Ysc0ZBQXNGO1FBQ3RGLE9BQU8sUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsOEJBQThCLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMzRSxDQUFDLENBQUM7SUFFRiw2Q0FBNkM7SUFDN0MseURBQXlEO0lBQ3pELFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLENBQUM7SUFFdEMsdUZBQXVGO0lBQ3ZGLG1GQUFtRjtJQUNuRixpRkFBaUY7SUFDakYsaUZBQWlGO0lBQ2pGLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzdDLElBQUksU0FBUyxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMxQyxZQUFZLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDO1FBQ2pELENBQUM7YUFBTSxDQUFDO1lBQ04sWUFBWSxDQUFDLDBCQUEwQixHQUFHLEtBQUssQ0FBQztRQUNsRCxDQUFDO0lBQ0gsQ0FBQztJQUVELHVGQUF1RjtJQUN2RixvRkFBb0Y7SUFDcEYsNEVBQTRFO0lBQzVFLElBQUksWUFBWSxDQUFDLDBCQUEwQixFQUFFLENBQUM7UUFDNUMsU0FBUyxDQUFDLHVCQUF1QixHQUFHLElBQUksQ0FBQztJQUMzQyxDQUFDO0lBRUQsc0ZBQXNGO0lBQ3RGLHlFQUF5RTtJQUN6RSxzRUFBc0U7SUFDdEUsTUFBTSxzQkFBc0IsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDO0lBQ3BELFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7UUFDMUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDOUIsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFDRCxPQUFPLHNCQUFzQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDMUQsQ0FBQyxDQUFDO0lBQ0YsTUFBTSw2QkFBNkIsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2pGLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtRQUNoRCxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUN2QyxTQUFTLENBQUMsT0FBTyxFQUNqQixZQUFZLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUN2QyxDQUFDO1FBRUYsK0VBQStFO1FBQy9FLHdCQUF3QjtRQUN4QixtRUFBbUU7UUFDbkUsMEZBQTBGO1FBQzFGLHVDQUF1QztRQUN2QyxJQUFJLFFBQVEsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUUxRSxnRUFBZ0U7UUFDaEUsd0ZBQXdGO1FBQ3hGLGtGQUFrRjtRQUNsRiw2REFBNkQ7UUFDN0QsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUV6RSxJQUNFLGVBQWU7WUFDZixRQUFRLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLENBQUM7WUFFckYsT0FBTyxJQUFJLENBQUM7UUFFZCxPQUFPLDZCQUE2QixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2pELENBQUMsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBQyxDQUFDLENBQUM7SUFDakYsV0FBVyxDQUNULE1BQU0sRUFDTixZQUFZLEVBQ1osUUFBUSxFQUNSLFNBQVMsQ0FBQyxhQUFhLEVBQ3ZCLFNBQVMsQ0FBQyxvQkFBb0IsRUFDOUIsQ0FBQyxDQUFDLDRCQUE0QixDQUMvQixDQUFDO0lBRUYsTUFBTSxDQUFDLGlCQUFpQixHQUFHLENBQUMsUUFBZ0IsRUFBRSxvQkFBNEIsRUFBRSxFQUFFLENBQzVFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUNiLFNBQVMsQ0FBQyxhQUFhLEVBQ3ZCLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUN4RCxDQUFDO0lBQ0osSUFBSSx3QkFBd0IsRUFBRSxDQUFDO1FBQzdCLHVEQUF1RDtRQUN2RCxpRUFBaUU7UUFDakUsZ0ZBQWdGO1FBQ2hGLG9GQUFvRjtRQUNwRixNQUFNLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxRQUFnQixFQUFFLG9CQUE0QixFQUFFLEVBQUU7WUFDOUUsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbEUsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLGlCQUFpQixDQUFDLEdBQUcsT0FBTyxDQUFDO1FBQzNFLENBQUMsQ0FBQztJQUNKLENBQUM7SUFDRCxzRkFBc0Y7SUFDdEYsd0JBQXdCO0lBQ3ZCLE1BQWMsQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLFlBQW9CLEVBQUUsRUFBRTtRQUMvRCxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELE9BQU8sQ0FBQyxLQUFLLENBQUMsK0VBQStFLENBQUMsQ0FBQztJQUNqRyxDQUFDLENBQUM7SUFFRixNQUFNLFlBQVksR0FBcUMsQ0FBQyxFQUN0RCxPQUFPLEVBQ1AsZ0JBQWdCLEVBQ2hCLFNBQVMsRUFDVCxpQkFBaUIsRUFDakIsZ0JBQWdCLEVBQ2hCLGtCQUFrQixHQUFHLEVBQUUsR0FDeEIsRUFBRSxFQUFFLENBQ0gsT0FBTyxDQUFDLElBQUksQ0FDVixnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULGlCQUFpQixFQUNqQixnQkFBZ0IsRUFDaEIsa0JBQWtCLENBQ25CLENBQUM7SUFFSixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN2QixpQkFBaUIsR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQzlCLDhCQUE4QixDQUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUNELE1BQU0sRUFBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBQyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztRQUMvRCxTQUFTLEVBQUUsS0FBSztRQUNoQixPQUFPLEVBQUUsWUFBWTtRQUNyQixJQUFJLEVBQUUsTUFBTTtRQUNaLFlBQVk7UUFDWixpQkFBaUI7S0FDbEIsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxPQUFPLEdBQUcsbUJBQW1CLENBQUM7SUFDbEMsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0YsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2QsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdkIsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDeEUsQ0FBQztJQUNILENBQUM7SUFFRCw0RUFBNEU7SUFDNUUscURBQXFEO0lBQ3JELElBQUksQ0FBQyxPQUFPO1FBQUUsT0FBTyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQztJQUU1QyxJQUFJLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ2pDLHlFQUF5RTtRQUN6RSw0RUFBNEU7UUFDNUUsYUFBYTtRQUNiLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRCx3RUFBd0U7SUFDeEUsb0RBQW9EO0lBQ3BELEtBQUssTUFBTSxRQUFRLElBQUksZUFBZSxFQUFFLENBQUM7UUFDdkMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN6QiwwQkFBMEIsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRCxPQUFPLEVBQUMsT0FBTyxFQUFFLFdBQVcsRUFBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQ3hDLE9BQW1CLEVBQ25CLE9BQWUsRUFDZixTQUF1QjtJQUV2QixJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixFQUFFLENBQUM7UUFDckMsT0FBTztJQUNULENBQUM7SUFDRCxJQUFJLFNBQVMsQ0FBQyxhQUFhLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDMUMsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0lBQzVGLENBQUM7SUFFRCx1RUFBdUU7SUFDdkUsMkNBQTJDO0lBQzNDLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7SUFDNUIsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQztRQUNsRCxnREFBZ0Q7UUFDaEQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELDZFQUE2RTtJQUM3RSxtREFBbUQ7SUFDbkQsTUFBTSxZQUFZLEdBQWEsRUFBRSxDQUFDO0lBQ2xDLEtBQUssTUFBTSxDQUFDLElBQUksU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3hDLDBFQUEwRTtRQUMxRSxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDbkUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyQixTQUFTO1FBQ1gsQ0FBQztRQUVELDhFQUE4RTtJQUNoRixDQUFDO0lBRUQsdUVBQXVFO0lBQ3ZFLHNCQUFzQjtJQUN0QixxRUFBcUU7SUFDckUsRUFBRSxDQUFDLGFBQWEsQ0FDZCxTQUFTLENBQUMsb0JBQW9CLEVBQzlCLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUM5RCxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsU0FBdUIsRUFBRSxFQUFpQjtJQUNyRSxPQUFPLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLFFBQWdCO0lBQ2pELE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVELFNBQVMsOEJBQThCLENBQ3JDLE9BQTJCLEVBQzNCLFNBQXVCLEVBQ3ZCLFNBQXFCO0lBRXJCLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUUzQyx3RkFBd0Y7SUFDeEYsSUFBSSxhQUFhLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQztJQUMxQyxJQUFJLFNBQVMsWUFBWSxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDekMsYUFBYSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN6RixDQUFDO0lBQ0QsTUFBTSxXQUFXLEdBQW9CLEVBQUUsQ0FBQztJQUN4QyxtRUFBbUU7SUFDbkUsOERBQThEO0lBQzlELG9FQUFvRTtJQUNwRSxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQztJQUN2RCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQztJQUN0RCxNQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsY0FBYyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzdDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQix5REFBeUQ7UUFDekQsK0JBQStCO1FBQy9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUUzRCw2RkFBNkY7UUFDN0YsK0ZBQStGO1FBQy9GLFlBQVk7UUFDWixJQUFJLE9BQU8sQ0FBQyxlQUFlLEtBQUssb0JBQW9CLEVBQUUsQ0FBQztZQUNyRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUQsQ0FBQztJQUNILENBQUM7SUFFRCxJQUFJLFNBQVMsWUFBWSxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDekMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3hCLGdFQUFnRTtRQUNoRSxzQkFBc0I7UUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7UUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUNELE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsbUNBQW1DLENBQ2pELE1BQXVCLEVBQ3ZCLFlBQWdDLEVBQ2hDLFNBQXVCLEVBQ3ZCLFFBQWtCLEVBQ2xCLDRCQUFxQztJQUVyQyxXQUFXLENBQ1QsTUFBTSxFQUNOLFlBQVksRUFDWixRQUFRLEVBQ1IsU0FBUyxDQUFDLGFBQWEsRUFDdkIsU0FBUyxDQUFDLG9CQUFvQixFQUM5Qiw0QkFBNEIsQ0FDN0IsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8gYHRzYy13cmFwcGVkYCBoZWxwZXJzIGFyZSBub3QgZXhwb3NlZCBpbiB0aGUgcHJpbWFyeSBgQGJhemVsL2NvbmNhdGpzYCBlbnRyeS1wb2ludC5cbmltcG9ydCAqIGFzIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQge1BlcmZQaGFzZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3ByaXZhdGUvYmF6ZWwnO1xuaW1wb3J0IHRzY3cgZnJvbSAnQGJhemVsL2NvbmNhdGpzL2ludGVybmFsL3RzY193cmFwcGVkL2luZGV4LmpzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7RVhULCBwYXRjaE5nSG9zdFdpdGhGaWxlTmFtZVRvTW9kdWxlTmFtZSBhcyBwYXRjaE5nSG9zdCwgcmVsYXRpdmVUb1Jvb3REaXJzfSBmcm9tICcuL3V0aWxzJztcblxuLy8gQWRkIGRldm1vZGUgZm9yIGJsYXplIGludGVybmFsXG5pbnRlcmZhY2UgQmF6ZWxPcHRpb25zIGV4dGVuZHMgdHNjdy5CYXplbE9wdGlvbnMge1xuICBhbGxvd2VkSW5wdXRzPzogc3RyaW5nW107XG4gIHVudXNlZElucHV0c0xpc3RQYXRoPzogc3RyaW5nO1xufVxuXG4vLyBGSVhNRTogd2Ugc2hvdWxkIGJlIGFibGUgdG8gYWRkIHRoZSBhc3NldHMgdG8gdGhlIHRzY29uZmlnIHNvIEZpbGVMb2FkZXJcbi8vIGtub3dzIGFib3V0IHRoZW1cbmNvbnN0IE5HQ19BU1NFVFMgPSAvXFwuKGNzc3xodG1sKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYWluKGFyZ3M6IHN0cmluZ1tdKSB7XG4gIGlmICh0c2N3LnJ1bkFzV29ya2VyKGFyZ3MpKSB7XG4gICAgYXdhaXQgdHNjdy5ydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKGF3YWl0IHJ1bk9uZUJ1aWxkKGFyZ3MpKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgdHNjdy5GaWxlQ2FjaGU8dHMuU291cmNlRmlsZT4odHNjdy5kZWJ1Zyk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChcbiAgYXJnczogc3RyaW5nW10sXG4gIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoYXJnc1swXSA9PT0gJy1wJykge1xuICAgIGFyZ3Muc2hpZnQoKTtcbiAgfVxuXG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSB0c2N3LnBhcnNlVHNjb25maWcocHJvamVjdCk7XG4gIGlmIChlcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChwYXJzZWRPcHRpb25zID09PSBudWxsKSB7XG4gICAgY29uc29sZS5lcnJvcignQ291bGQgbm90IHBhcnNlIHRzY29uZmlnLiBObyBwYXJzZSBkaWFnbm9zdGljcyBwcm92aWRlZC4nKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB7YmF6ZWxPcHRzLCBvcHRpb25zOiB0c09wdGlvbnMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3Qge2Vycm9yczogdXNlckVycm9ycywgb3B0aW9uczogdXNlck9wdGlvbnN9ID0gbmcucmVhZENvbmZpZ3VyYXRpb24ocHJvamVjdCk7XG5cbiAgaWYgKHVzZXJFcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3ModXNlckVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcyA9IG5ldyBTZXQ8c3RyaW5nPihbXG4gICAgJ2RpYWdub3N0aWNzJyxcbiAgICAndHJhY2UnLFxuICAgICdkaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nJyxcbiAgICAnZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2snLFxuICAgICdpMThuT3V0TG9jYWxlJyxcbiAgICAnaTE4bk91dEZvcm1hdCcsXG4gICAgJ2kxOG5PdXRGaWxlJyxcbiAgICAnaTE4bkluTG9jYWxlJyxcbiAgICAnaTE4bkluRmlsZScsXG4gICAgJ2kxOG5JbkZvcm1hdCcsXG4gICAgJ2kxOG5Vc2VFeHRlcm5hbElkcycsXG4gICAgJ2kxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMnLFxuICAgICdwcmVzZXJ2ZVdoaXRlc3BhY2VzJyxcbiAgICAnY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzJyxcbiAgICAnZXh0ZW5kZWREaWFnbm9zdGljcycsXG4gICAgJ2ZvcmJpZE9ycGhhbkNvbXBvbmVudHMnLFxuICAgICdvbmx5RXhwbGljaXREZWZlckRlcGVuZGVuY3lJbXBvcnRzJyxcbiAgICAnZ2VuZXJhdGVFeHRyYUltcG9ydHNJbkxvY2FsTW9kZScsXG4gICAgJ19lbmFibGVMZXRTeW50YXgnLFxuICBdKTtcblxuICBjb25zdCB1c2VyT3ZlcnJpZGVzID0gT2JqZWN0LmVudHJpZXModXNlck9wdGlvbnMpXG4gICAgLmZpbHRlcigoW2tleV0pID0+IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcy5oYXMoa2V5KSlcbiAgICAucmVkdWNlKFxuICAgICAgKG9iaiwgW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH0sXG4gICAgICB7fSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICApO1xuXG4gIC8vIEFuZ3VsYXIgQ29tcGlsZXIgb3B0aW9ucyBhcmUgYWx3YXlzIHNldCB1bmRlciBCYXplbC4gU2VlIGBuZ19tb2R1bGUuYnpsYC5cbiAgY29uc3QgYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMgPSAoY29uZmlnIGFzIHthbmd1bGFyQ29tcGlsZXJPcHRpb25zOiBuZy5Bbmd1bGFyQ29tcGlsZXJPcHRpb25zfSlbXG4gICAgJ2FuZ3VsYXJDb21waWxlck9wdGlvbnMnXG4gIF07XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBuZy5Bbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uYW5ndWxhckNvbmZpZ1Jhd09wdGlvbnMsXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGFuZ3VsYXJDb25maWdSYXdPcHRpb25zO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoKGQpID0+IGQuY2F0ZWdvcnkgIT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsID0gdHJ1ZSxcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgY29tcGlsZXJPcHRzLFxuICB0c0hvc3QsXG4gIGJhemVsT3B0cyxcbiAgZmlsZXMsXG4gIGlucHV0cyxcbiAgZXhwZWN0ZWRPdXRzLFxuICBnYXRoZXJEaWFnbm9zdGljcyxcbiAgYmF6ZWxIb3N0LFxufToge1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuO1xuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lPzogYm9vbGVhbjtcbiAgY29tcGlsZXJPcHRzOiBuZy5Db21waWxlck9wdGlvbnM7XG4gIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0O1xuICBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ307XG4gIGJhemVsT3B0czogQmF6ZWxPcHRpb25zO1xuICBmaWxlczogc3RyaW5nW107XG4gIGV4cGVjdGVkT3V0czogc3RyaW5nW107XG4gIGdhdGhlckRpYWdub3N0aWNzPzogKHByb2dyYW06IG5nLlByb2dyYW0pID0+IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXTtcbiAgYmF6ZWxIb3N0PzogdHNjdy5Db21waWxlckhvc3Q7XG59KToge2RpYWdub3N0aWNzOiByZWFkb25seSB0cy5EaWFnbm9zdGljW107IHByb2dyYW06IG5nLlByb2dyYW0gfCB1bmRlZmluZWR9IHtcbiAgbGV0IGZpbGVMb2FkZXI6IHRzY3cuRmlsZUxvYWRlcjtcblxuICAvLyBUaGVzZSBvcHRpb25zIGFyZSBleHBlY3RlZCB0byBiZSBzZXQgaW4gQmF6ZWwuIFNlZTpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JhemVsYnVpbGQvcnVsZXNfbm9kZWpzL2Jsb2IvNTkxZTc2ZWRjOWVlMGE3MWQ2MDRjNTk5OWFmOGJhZDc5MDllZjJkNC9wYWNrYWdlcy9jb25jYXRqcy9pbnRlcm5hbC9jb21tb24vdHNjb25maWcuYnpsI0wyNDYuXG4gIGNvbnN0IGJhc2VVcmwgPSBjb21waWxlck9wdHMuYmFzZVVybCE7XG4gIGNvbnN0IHJvb3REaXIgPSBjb21waWxlck9wdHMucm9vdERpciE7XG4gIGNvbnN0IHJvb3REaXJzID0gY29tcGlsZXJPcHRzLnJvb3REaXJzITtcblxuICBpZiAoYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBtYXhDYWNoZVNpemVCeXRlcyA9IGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAqICgxIDw8IDIwKTtcbiAgICBmaWxlQ2FjaGUuc2V0TWF4Q2FjaGVTaXplKG1heENhY2hlU2l6ZUJ5dGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlQ2FjaGUucmVzZXRNYXhDYWNoZVNpemUoKTtcbiAgfVxuXG4gIGlmIChpbnB1dHMpIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IHRzY3cuQ2FjaGVkRmlsZUxvYWRlcihmaWxlQ2FjaGUpO1xuICAgIC8vIFJlc29sdmUgdGhlIGlucHV0cyB0byBhYnNvbHV0ZSBwYXRocyB0byBtYXRjaCBUeXBlU2NyaXB0IGludGVybmFsc1xuICAgIGNvbnN0IHJlc29sdmVkSW5wdXRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBjb25zdCBpbnB1dEtleXMgPSBPYmplY3Qua2V5cyhpbnB1dHMpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBrZXkgPSBpbnB1dEtleXNbaV07XG4gICAgICByZXNvbHZlZElucHV0cy5zZXQodHNjdy5yZXNvbHZlTm9ybWFsaXplZFBhdGgoa2V5KSwgaW5wdXRzW2tleV0pO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgdHNjdy5VbmNhY2hlZEZpbGVMb2FkZXIoKTtcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGlmICghY29tcGlsZXJPcHRzLnJvb3REaXJzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdyb290RGlycyBpcyBub3Qgc2V0IScpO1xuICB9XG4gIGNvbnN0IGJhemVsQmluID0gY29tcGlsZXJPcHRzLnJvb3REaXJzLmZpbmQoKHJvb3REaXIpID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0c1NldCA9IG5ldyBTZXQoZXhwZWN0ZWRPdXRzLm1hcCgocCkgPT4gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChwKSkpO1xuXG4gIGNvbnN0IG9yaWdpbmFsV3JpdGVGaWxlID0gdHNIb3N0LndyaXRlRmlsZS5iaW5kKHRzSG9zdCk7XG4gIHRzSG9zdC53cml0ZUZpbGUgPSAoXG4gICAgZmlsZU5hbWU6IHN0cmluZyxcbiAgICBjb250ZW50OiBzdHJpbmcsXG4gICAgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLFxuICAgIHNvdXJjZUZpbGVzPzogcmVhZG9ubHkgdHMuU291cmNlRmlsZVtdLFxuICApID0+IHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IHJlbGF0aXZlVG9Sb290RGlycyhjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVOYW1lKSwgW3Jvb3REaXJdKTtcbiAgICBpZiAoZXhwZWN0ZWRPdXRzU2V0LmhhcyhyZWxhdGl2ZSkpIHtcbiAgICAgIGV4cGVjdGVkT3V0c1NldC5kZWxldGUocmVsYXRpdmUpO1xuICAgICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgIH1cbiAgfTtcblxuICBpZiAoIWJhemVsSG9zdCkge1xuICAgIGJhemVsSG9zdCA9IG5ldyB0c2N3LkNvbXBpbGVySG9zdChmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlcik7XG4gIH1cblxuICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAvLyBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBzaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgY2hlY2tzIHdoZXRoZXIgYGZpbGVOYW1lYCBpcyBwYXJ0IG9mXG4gICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAvLyBzaGltcyBmb3Igb3JpZ2luYWwgLnRzIGZpbGVzIGluIHRoZSBwcm9ncmFtIHNob3VsZCBiZSB0cmVhdGVkIGlkZW50aWNhbGx5LiBUaHVzLCBzdHJpcCB0aGVcbiAgICAvLyAnLm5nZmFjdG9yeScgb3IgJy5uZ3N1bW1hcnknIHBhcnQgb2YgdGhlIGZpbGVuYW1lIGF3YXkgYmVmb3JlIGNhbGxpbmcgdGhlIGRlbGVnYXRlLlxuICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICB9O1xuXG4gIC8vIE5ldmVyIHJ1biB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtLlxuICAvLyBUT0RPKGIvMjU0MDU0MTAzKTogUmVtb3ZlIHRoZSB0cmFuc2Zvcm0gYW5kIHRoaXMgZmxhZy5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlICYmICFiYXplbE9wdHMuZGV2bW9kZSkge1xuICAgIGlmIChiYXplbE9wdHMud29ya3NwYWNlTmFtZSA9PT0gJ2dvb2dsZTMnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBBbmd1bGFyIGNvbXBpbGVyIG9wdGlvbiBpcyBub3QgcmVzcGVjdGVkIGJ5IGRlZmF1bHRcbiAgLy8gYXMgbmdjLXdyYXBwZWQgaGFuZGxlcyB0c2lja2xlIGVtaXQgb24gaXRzIG93bi4gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gdXBkYXRlXG4gIC8vIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QgYmFzZWQgb24gdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgZmxhZy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gIH1cblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3Qgb3JpZ0JhemVsSG9zdEZpbGVFeGlzdCA9IGJhemVsSG9zdC5maWxlRXhpc3RzO1xuICBiYXplbEhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKE5HQ19BU1NFVFMudGVzdChmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0LmNhbGwoYmF6ZWxIb3N0LCBmaWxlTmFtZSk7XG4gIH07XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlID0gYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZmxhdE1vZHVsZU91dFBhdGggPSBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMucGFja2FnZSxcbiAgICAgIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnLFxuICAgICk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGJhc2VVcmwsIGZsYXRNb2R1bGVPdXRQYXRoKSkgcmV0dXJuIHRydWU7XG5cbiAgICAvLyBBbHNvIGhhbmRsZSB0aGUgY2FzZSB0aGUgdGFyZ2V0IGlzIGluIGFuIGV4dGVybmFsIHJlcG9zaXRvcnkuXG4gICAgLy8gUHVsbCB0aGUgd29ya3NwYWNlIG5hbWUgZnJvbSB0aGUgdGFyZ2V0IHdoaWNoIGlzIGZvcm1hdHRlZCBhcyBgQHdrc3AvL3BhY2thZ2U6dGFyZ2V0YFxuICAgIC8vIGlmIGl0IHRoZSB0YXJnZXQgaXMgZnJvbSBhbiBleHRlcm5hbCB3b3Jrc3BhY2UuIElmIHRoZSB0YXJnZXQgaXMgZnJvbSB0aGUgbG9jYWxcbiAgICAvLyB3b3Jrc3BhY2UgdGhlbiBpdCB3aWxsIGJlIGZvcm1hdHRlZCBhcyBgLy9wYWNrYWdlOnRhcmdldGAuXG4gICAgY29uc3QgdGFyZ2V0V29ya3NwYWNlID0gYmF6ZWxPcHRzLnRhcmdldC5zcGxpdCgnLycpWzBdLnJlcGxhY2UoL15ALywgJycpO1xuXG4gICAgaWYgKFxuICAgICAgdGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICBmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpXG4gICAgKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGNvbnN0IG5nSG9zdCA9IG5nLmNyZWF0ZUNvbXBpbGVySG9zdCh7b3B0aW9uczogY29tcGlsZXJPcHRzLCB0c0hvc3Q6IGJhemVsSG9zdH0pO1xuICBwYXRjaE5nSG9zdChcbiAgICBuZ0hvc3QsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHJvb3REaXJzLFxuICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLFxuICAgIGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYyxcbiAgICAhIXVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gICk7XG5cbiAgbmdIb3N0LnRvU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpID0+XG4gICAgcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIHJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpLFxuICAgICk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHRzY3cucmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCB3b3Jrc3BhY2VSZWxhdGl2ZSkgKyAnLmQudHMnO1xuICAgIH07XG4gIH1cbiAgLy8gUGF0Y2ggYSBwcm9wZXJ0eSBvbiB0aGUgbmdIb3N0IHRoYXQgYWxsb3dzIHRoZSByZXNvdXJjZU5hbWVUb01vZHVsZU5hbWUgZnVuY3Rpb24gdG9cbiAgLy8gcmVwb3J0IGJldHRlciBlcnJvcnMuXG4gIChuZ0hvc3QgYXMgYW55KS5yZXBvcnRNaXNzaW5nUmVzb3VyY2UgPSAocmVzb3VyY2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGBcXG5Bc3NldCBub3QgZm91bmQ6XFxuICAke3Jlc291cmNlTmFtZX1gKTtcbiAgICBjb25zb2xlLmVycm9yKFwiQ2hlY2sgdGhhdCBpdCdzIGluY2x1ZGVkIGluIHRoZSBgYXNzZXRzYCBhdHRyaWJ1dGUgb2YgdGhlIGBuZ19tb2R1bGVgIHJ1bGUuXFxuXCIpO1xuICB9O1xuXG4gIGNvbnN0IGVtaXRDYWxsYmFjazogbmcuVHNFbWl0Q2FsbGJhY2s8dHMuRW1pdFJlc3VsdD4gPSAoe1xuICAgIHByb2dyYW0sXG4gICAgdGFyZ2V0U291cmNlRmlsZSxcbiAgICB3cml0ZUZpbGUsXG4gICAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gICAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgfSkgPT5cbiAgICBwcm9ncmFtLmVtaXQoXG4gICAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgICAgd3JpdGVGaWxlLFxuICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gICAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgICAgY3VzdG9tVHJhbnNmb3JtZXJzLFxuICAgICk7XG5cbiAgaWYgKCFnYXRoZXJEaWFnbm9zdGljcykge1xuICAgIGdhdGhlckRpYWdub3N0aWNzID0gKHByb2dyYW0pID0+XG4gICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0pO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oe1xuICAgIHJvb3ROYW1lczogZmlsZXMsXG4gICAgb3B0aW9uczogY29tcGlsZXJPcHRzLFxuICAgIGhvc3Q6IG5nSG9zdCxcbiAgICBlbWl0Q2FsbGJhY2ssXG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIH0pO1xuICBsZXQgZXh0ZXJucyA9ICcvKiogQGV4dGVybnMgKi9cXG4nO1xuICBjb25zdCBoYXNFcnJvciA9IGRpYWdub3N0aWNzLnNvbWUoKGRpYWcpID0+IGRpYWcuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG4gIGlmICghaGFzRXJyb3IpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLm1hbmlmZXN0KSB7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgJy8vIEVtcHR5LiBTaG91bGQgbm90IGJlIHVzZWQuJyk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgY29tcGlsYXRpb24gZmFpbHMgdW5leHBlY3RlZGx5LCBwZXJmb3JtQ29tcGlsYXRpb24gcmV0dXJucyBubyBwcm9ncmFtLlxuICAvLyBNYWtlIHN1cmUgbm90IHRvIGNyYXNoIGJ1dCByZXBvcnQgdGhlIGRpYWdub3N0aWNzLlxuICBpZiAoIXByb2dyYW0pIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIC8vIFRoZXJlIG1pZ2h0IGJlIHNvbWUgZXhwZWN0ZWQgb3V0cHV0IGZpbGVzIHRoYXQgYXJlIG5vdCB3cml0dGVuIGJ5IHRoZVxuICAvLyBjb21waWxlci4gSW4gdGhpcyBjYXNlLCBqdXN0IHdyaXRlIGFuIGVtcHR5IGZpbGUuXG4gIGZvciAoY29uc3QgZmlsZU5hbWUgb2YgZXhwZWN0ZWRPdXRzU2V0KSB7XG4gICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsICcnLCBmYWxzZSk7XG4gIH1cblxuICBpZiAoIWNvbXBpbGVyT3B0cy5ub0VtaXQpIHtcbiAgICBtYXliZVdyaXRlVW51c2VkSW5wdXRzTGlzdChwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCByb290RGlyLCBiYXplbE9wdHMpO1xuICB9XG5cbiAgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG59XG5cbi8qKlxuICogV3JpdGVzIGEgY29sbGVjdGlvbiBvZiB1bnVzZWQgaW5wdXQgZmlsZXMgYW5kIGRpcmVjdG9yaWVzIHdoaWNoIGNhbiBiZVxuICogY29uc3VtZWQgYnkgYmF6ZWwgdG8gYXZvaWQgdHJpZ2dlcmluZyByZWJ1aWxkcyBpZiBvbmx5IHVudXNlZCBpbnB1dHMgYXJlXG4gKiBjaGFuZ2VkLlxuICpcbiAqIFNlZSBodHRwczovL2JhemVsLmJ1aWxkL2NvbnRyaWJ1dGUvY29kZWJhc2UjaW5wdXQtZGlzY292ZXJ5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVdyaXRlVW51c2VkSW5wdXRzTGlzdChcbiAgcHJvZ3JhbTogdHMuUHJvZ3JhbSxcbiAgcm9vdERpcjogc3RyaW5nLFxuICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbikge1xuICBpZiAoIWJhemVsT3B0cz8udW51c2VkSW5wdXRzTGlzdFBhdGgpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGJhemVsT3B0cy5hbGxvd2VkSW5wdXRzID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2B1bnVzZWRJbnB1dHNMaXN0UGF0aGAgaXMgc2V0LCBidXQgbm8gbGlzdCBvZiBhbGxvd2VkIGlucHV0cyBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIHRzLlByb2dyYW0ncyBnZXRTb3VyY2VGaWxlcygpIGdldHMgcG9wdWxhdGVkIGJ5IHRoZSBzb3VyY2VzIGFjdHVhbGx5XG4gIC8vIGxvYWRlZCB3aGlsZSB0aGUgcHJvZ3JhbSBpcyBiZWluZyBidWlsdC5cbiAgY29uc3QgdXNlZEZpbGVzID0gbmV3IFNldCgpO1xuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgcHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgLy8gT25seSBjb25jZXJuIG91cnNlbHZlcyB3aXRoIHR5cGVzY3JpcHQgZmlsZXMuXG4gICAgdXNlZEZpbGVzLmFkZChzb3VyY2VGaWxlLmZpbGVOYW1lKTtcbiAgfVxuXG4gIC8vIGFsbG93ZWRJbnB1dHMgYXJlIGFic29sdXRlIHBhdGhzIHRvIGZpbGVzIHdoaWNoIG1heSBhbHNvIGVuZCB3aXRoIC8qIHdoaWNoXG4gIC8vIGltcGxpZXMgYW55IGZpbGVzIGluIHRoYXQgZGlyZWN0b3J5IGNhbiBiZSB1c2VkLlxuICBjb25zdCB1bnVzZWRJbnB1dHM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgZiBvZiBiYXplbE9wdHMuYWxsb3dlZElucHV0cykge1xuICAgIC8vIEEgdHMveCBmaWxlIGlzIHVudXNlZCBpZiBpdCB3YXMgbm90IGZvdW5kIGRpcmVjdGx5IGluIHRoZSB1c2VkIHNvdXJjZXMuXG4gICAgaWYgKChmLmVuZHNXaXRoKCcudHMnKSB8fCBmLmVuZHNXaXRoKCcudHN4JykpICYmICF1c2VkRmlsZXMuaGFzKGYpKSB7XG4gICAgICB1bnVzZWRJbnB1dHMucHVzaChmKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRPRE86IEl0ZXJhdGUgb3ZlciBjb250ZW50cyBvZiBhbGxvd2VkIGRpcmVjdG9yaWVzIGNoZWNraW5nIGZvciB1c2VkIGZpbGVzLlxuICB9XG5cbiAgLy8gQmF6ZWwgZXhwZWN0cyB0aGUgdW51c2VkIGlucHV0IGxpc3QgdG8gY29udGFpbiBwYXRocyByZWxhdGl2ZSB0byB0aGVcbiAgLy8gZXhlY3Jvb3QgZGlyZWN0b3J5LlxuICAvLyBTZWUgaHR0cHM6Ly9kb2NzLmJhemVsLmJ1aWxkL3ZlcnNpb25zL21haW4vb3V0cHV0X2RpcmVjdG9yaWVzLmh0bWxcbiAgZnMud3JpdGVGaWxlU3luYyhcbiAgICBiYXplbE9wdHMudW51c2VkSW5wdXRzTGlzdFBhdGgsXG4gICAgdW51c2VkSW5wdXRzLm1hcCgoZikgPT4gcGF0aC5yZWxhdGl2ZShyb290RGlyLCBmKSkuam9pbignXFxuJyksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsIHNmOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gIHJldHVybiBiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZmlsZVBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xufVxuXG5mdW5jdGlvbiBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoXG4gIG9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gIG5nUHJvZ3JhbTogbmcuUHJvZ3JhbSxcbik6IHRzLkRpYWdub3N0aWNbXSB7XG4gIGNvbnN0IHRzUHJvZ3JhbSA9IG5nUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcblxuICAvLyBGb3IgdGhlIEl2eSBjb21waWxlciwgdHJhY2sgdGhlIGFtb3VudCBvZiB0aW1lIHNwZW50IGZldGNoaW5nIFR5cGVTY3JpcHQgZGlhZ25vc3RpY3MuXG4gIGxldCBwcmV2aW91c1BoYXNlID0gUGVyZlBoYXNlLlVuYWNjb3VudGVkO1xuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgcHJldmlvdXNQaGFzZSA9IG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UoUGVyZlBoYXNlLlR5cGVTY3JpcHREaWFnbm9zdGljcyk7XG4gIH1cbiAgY29uc3QgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuICAvLyBUaGVzZSBjaGVja3MgbWlycm9yIHRzLmdldFByZUVtaXREaWFnbm9zdGljcywgd2l0aCB0aGUgaW1wb3J0YW50XG4gIC8vIGV4Y2VwdGlvbiBvZiBhdm9pZGluZyBiLzMwNzA4MjQwLCB3aGljaCBpcyB0aGF0IGlmIHlvdSBjYWxsXG4gIC8vIHByb2dyYW0uZ2V0RGVjbGFyYXRpb25EaWFnbm9zdGljcygpIGl0IHNvbWVob3cgY29ycnVwdHMgdGhlIGVtaXQuXG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpKTtcbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKSk7XG4gIGNvbnN0IHByb2dyYW1GaWxlcyA9IHRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcigoZikgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcblxuICAgIC8vIEluIGxvY2FsIG1vZGUgY29tcGlsYXRpb24gdGhlIFRTIHNlbWFudGljIGNoZWNrIGlzc3VlcyB0b25zIG9mIGRpYWdub3N0aWNzIGR1ZSB0byB0aGUgZmFjdFxuICAgIC8vIHRoYXQgdGhlIGZpbGUgZGVwZW5kZW5jaWVzICguZC50cyBmaWxlcykgYXJlIG5vdCBhdmFpbGFibGUgaW4gdGhlIHByb2dyYW0uIFNvIGl0IG5lZWRzIHRvIGJlXG4gICAgLy8gZGlzYWJsZWQuXG4gICAgaWYgKG9wdGlvbnMuY29tcGlsYXRpb25Nb2RlICE9PSAnZXhwZXJpbWVudGFsLWxvY2FsJykge1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzZikpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKHByZXZpb3VzUGhhc2UpO1xuICB9XG5cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqIEtlcHQgaGVyZSBqdXN0IGZvciBjb21wYXRpYmlsaXR5IHdpdGggMVAgdG9vbHMuIFRvIGJlIHJlbW92ZWQgc29vbiBhZnRlciAxUCB1cGRhdGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRjaE5nSG9zdFdpdGhGaWxlTmFtZVRvTW9kdWxlTmFtZShcbiAgbmdIb3N0OiBuZy5Db21waWxlckhvc3QsXG4gIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLFxuICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgcm9vdERpcnM6IHN0cmluZ1tdLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBib29sZWFuLFxuKTogdm9pZCB7XG4gIHBhdGNoTmdIb3N0KFxuICAgIG5nSG9zdCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgcm9vdERpcnMsXG4gICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gICk7XG59XG4iXX0=