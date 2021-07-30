/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel", ["require", "exports", "@angular/compiler-cli", "@angular/compiler-cli/src/ngtsc/perf", "@bazel/typescript", "fs", "path", "tsickle/src/tsickle", "typescript"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.patchNgHostWithFileNameToModuleName = exports.compile = exports.relativeToRootDirs = exports.runOneBuild = exports.main = void 0;
    const ng = require("@angular/compiler-cli");
    const perf_1 = require("@angular/compiler-cli/src/ngtsc/perf");
    const typescript_1 = require("@bazel/typescript");
    const fs = require("fs");
    const path = require("path");
    const tsickle = require("tsickle/src/tsickle");
    const ts = require("typescript");
    const EXT = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
    const NGC_GEN_FILES = /^(.*?)\.(ngfactory|ngsummary|ngstyle|shim\.ngstyle)(.*)$/;
    // FIXME: we should be able to add the assets to the tsconfig so FileLoader
    // knows about them
    const NGC_ASSETS = /\.(css|html|ngsummary\.json)$/;
    const BAZEL_BIN = /\b(blaze|bazel)-out\b.*?\bbin\b/;
    // Note: We compile the content of node_modules with plain ngc command line.
    const ALL_DEPS_COMPILED_WITH_BAZEL = false;
    const NODE_MODULES = 'node_modules/';
    function main(args) {
        if (typescript_1.runAsWorker(args)) {
            typescript_1.runWorkerLoop(runOneBuild);
        }
        else {
            return runOneBuild(args) ? 0 : 1;
        }
        return 0;
    }
    exports.main = main;
    /** The one FileCache instance used in this process. */
    const fileCache = new typescript_1.FileCache(typescript_1.debug);
    function runOneBuild(args, inputs) {
        if (args[0] === '-p')
            args.shift();
        // Strip leading at-signs, used to indicate a params file
        const project = args[0].replace(/^@+/, '');
        const [parsedOptions, errors] = typescript_1.parseTsconfig(project);
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
    exports.runOneBuild = runOneBuild;
    function relativeToRootDirs(filePath, rootDirs) {
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
    exports.relativeToRootDirs = relativeToRootDirs;
    function compile({ allDepsCompiledWithBazel = true, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost }) {
        let fileLoader;
        if (bazelOpts.maxCacheSizeMb !== undefined) {
            const maxCacheSizeBytes = bazelOpts.maxCacheSizeMb * (1 << 20);
            fileCache.setMaxCacheSize(maxCacheSizeBytes);
        }
        else {
            fileCache.resetMaxCacheSize();
        }
        if (inputs) {
            fileLoader = new typescript_1.CachedFileLoader(fileCache);
            // Resolve the inputs to absolute paths to match TypeScript internals
            const resolvedInputs = new Map();
            const inputKeys = Object.keys(inputs);
            for (let i = 0; i < inputKeys.length; i++) {
                const key = inputKeys[i];
                resolvedInputs.set(typescript_1.resolveNormalizedPath(key), inputs[key]);
            }
            fileCache.updateCache(resolvedInputs);
        }
        else {
            fileLoader = new typescript_1.UncachedFileLoader();
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
            bazelHost = new typescript_1.CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader, generatedFileModuleResolver);
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
        patchNgHostWithFileNameToModuleName(ngHost, compilerOpts, bazelOpts, useManifestPathsAsModuleName);
        ngHost.toSummaryFileName = (fileName, referringSrcFileName) => path.posix.join(bazelOpts.workspaceName, relativeToRootDirs(fileName, compilerOpts.rootDirs).replace(EXT, ''));
        if (allDepsCompiledWithBazel) {
            // Note: The default implementation would work as well,
            // but we can be faster as we know how `toSummaryFileName` works.
            // Note: We can't do this if some deps have been compiled with the command line,
            // as that has a different implementation of fromSummaryFileName / toSummaryFileName
            ngHost.fromSummaryFileName = (fileName, referringLibFileName) => {
                const workspaceRelative = fileName.split('/').splice(1).join('/');
                return typescript_1.resolveNormalizedPath(bazelBin, workspaceRelative) + '.d.ts';
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
                const manifest = typescript_1.constructManifest(tsickleEmitResult.modulesManifest, bazelHost);
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
    exports.compile = compile;
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
                    const outFile = typescript_1.resolveNormalizedPath(bazelBin, shortPath);
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
        let previousPhase = perf_1.PerfPhase.Unaccounted;
        if (ngProgram instanceof ng.NgtscProgram) {
            previousPhase = ngProgram.compiler.perfRecorder.phase(perf_1.PerfPhase.TypeScriptDiagnostics);
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
    /**
     * Adds support for the optional `fileNameToModuleName` operation to a given `ng.CompilerHost`.
     *
     * This is used within `ngc-wrapped` and the Bazel compilation flow, but is exported here to allow
     * for other consumers of the compiler to access this same logic. For example, the xi18n operation
     * in g3 configures its own `ng.CompilerHost` which also requires `fileNameToModuleName` to work
     * correctly.
     */
    function patchNgHostWithFileNameToModuleName(ngHost, compilerOpts, bazelOpts, useManifestPathsAsModuleName) {
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
    }
    exports.patchNgHostWithFileNameToModuleName = patchNgHostWithFileNameToModuleName;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNENBQTRDO0lBQzVDLCtEQUErRDtJQUMvRCxrREFBc047SUFDdE4seUJBQXlCO0lBQ3pCLDZCQUE2QjtJQUM3QiwrQ0FBbUM7SUFDbkMsaUNBQWlDO0lBRWpDLE1BQU0sR0FBRyxHQUFHLGtDQUFrQyxDQUFDO0lBQy9DLE1BQU0sYUFBYSxHQUFHLDBEQUEwRCxDQUFDO0lBQ2pGLDJFQUEyRTtJQUMzRSxtQkFBbUI7SUFDbkIsTUFBTSxVQUFVLEdBQUcsK0JBQStCLENBQUM7SUFFbkQsTUFBTSxTQUFTLEdBQUcsaUNBQWlDLENBQUM7SUFFcEQsNEVBQTRFO0lBQzVFLE1BQU0sNEJBQTRCLEdBQUcsS0FBSyxDQUFDO0lBRTNDLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztJQUVyQyxTQUFnQixJQUFJLENBQUMsSUFBSTtRQUN2QixJQUFJLHdCQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDckIsMEJBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUM1QjthQUFNO1lBQ0wsT0FBTyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2xDO1FBQ0QsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBUEQsb0JBT0M7SUFFRCx1REFBdUQ7SUFDdkQsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFnQixrQkFBSyxDQUFDLENBQUM7SUFFdEQsU0FBZ0IsV0FBVyxDQUFDLElBQWMsRUFBRSxNQUFpQztRQUMzRSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJO1lBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25DLHlEQUF5RDtRQUN6RCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUUzQyxNQUFNLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxHQUFHLDBCQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkQsSUFBSSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsTUFBTSxFQUFFO1lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDNUMsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUVELE1BQU0sRUFBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFDLEdBQUcsYUFBYSxDQUFDO1FBQ3JFLE1BQU0sRUFBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUMsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFakYsSUFBSSxVQUFVLGFBQVYsVUFBVSx1QkFBVixVQUFVLENBQUUsTUFBTSxFQUFFO1lBQ3RCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDaEQsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUVELE1BQU0saUNBQWlDLEdBQUcsSUFBSSxHQUFHLENBQVM7WUFDeEQsYUFBYTtZQUNiLE9BQU87WUFDUCwyQkFBMkI7WUFDM0IsK0JBQStCO1lBQy9CLGVBQWU7WUFDZixlQUFlO1lBQ2YsYUFBYTtZQUNiLGNBQWM7WUFDZCxZQUFZO1lBQ1osY0FBYztZQUNkLG9CQUFvQjtZQUNwQiwyQkFBMkI7WUFDM0IscUJBQXFCO1lBQ3JCLHNDQUFzQztTQUN2QyxDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQzthQUN0QixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDN0QsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7WUFDNUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUVqQixPQUFPLEdBQUcsQ0FBQztRQUNiLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQyxNQUFNLFlBQVksaURBQ2IsYUFBYSxHQUNiLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxHQUNoQyxTQUFTLENBQ2IsQ0FBQztRQUVGLG9GQUFvRjtRQUNwRiwwRUFBMEU7UUFDMUUsTUFBTSxFQUFDLFdBQVcsRUFBRSw2QkFBNkIsRUFBQyxHQUFHLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBRXRGLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekQsTUFBTSxFQUFDLFdBQVcsRUFBQyxHQUFHLE9BQU8sQ0FBQztZQUM1Qix3QkFBd0IsRUFBRSw0QkFBNEI7WUFDdEQsNEJBQTRCLEVBQUUsNkJBQTZCO1lBQzNELFlBQVksRUFBRSxXQUFXO1lBQ3pCLFlBQVk7WUFDWixNQUFNO1lBQ04sU0FBUztZQUNULEtBQUs7WUFDTCxNQUFNO1NBQ1AsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ3RCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7U0FDbEQ7UUFDRCxPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBckVELGtDQXFFQztJQUVELFNBQWdCLGtCQUFrQixDQUFDLFFBQWdCLEVBQUUsUUFBa0I7UUFDckUsSUFBSSxDQUFDLFFBQVE7WUFBRSxPQUFPLFFBQVEsQ0FBQztRQUMvQix5REFBeUQ7UUFDekQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDeEMsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMvQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztnQkFBRSxPQUFPLEdBQUcsQ0FBQztTQUN2QztRQUNELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFURCxnREFTQztJQUVELFNBQWdCLE9BQU8sQ0FBQyxFQUN0Qix3QkFBd0IsR0FBRyxJQUFJLEVBQy9CLDRCQUE0QixFQUM1QixZQUFZLEVBQ1osTUFBTSxFQUNOLFNBQVMsRUFDVCxLQUFLLEVBQ0wsTUFBTSxFQUNOLFlBQVksRUFDWixpQkFBaUIsRUFDakIsU0FBUyxFQVVWO1FBQ0MsSUFBSSxVQUFzQixDQUFDO1FBRTNCLElBQUksU0FBUyxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUU7WUFDMUMsTUFBTSxpQkFBaUIsR0FBRyxTQUFTLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQy9ELFNBQVMsQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQztTQUM5QzthQUFNO1lBQ0wsU0FBUyxDQUFDLGlCQUFpQixFQUFFLENBQUM7U0FDL0I7UUFFRCxJQUFJLE1BQU0sRUFBRTtZQUNWLFVBQVUsR0FBRyxJQUFJLDZCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdDLHFFQUFxRTtZQUNyRSxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztZQUNqRCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3RDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUN6QyxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLGNBQWMsQ0FBQyxHQUFHLENBQUMsa0NBQXFCLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7YUFDN0Q7WUFDRCxTQUFTLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3ZDO2FBQU07WUFDTCxVQUFVLEdBQUcsSUFBSSwrQkFBa0IsRUFBRSxDQUFDO1NBQ3ZDO1FBRUQsZ0ZBQWdGO1FBQ2hGLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDO1FBQzdDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFO1lBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztTQUN6QztRQUNELE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ2hGLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLDRDQUE0QyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztTQUN0RjtRQUVELE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFckYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4RCxNQUFNLENBQUMsU0FBUztZQUNaLENBQUMsUUFBZ0IsRUFBRSxPQUFlLEVBQUUsa0JBQTJCLEVBQzlELE9BQW1DLEVBQUUsV0FBNkIsRUFBRSxFQUFFO2dCQUNyRSxNQUFNLFFBQVEsR0FDVixrQkFBa0IsQ0FBQyx5QkFBeUIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNwRixJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7b0JBQ2pDLGVBQWUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ2pDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2lCQUNoRjtZQUNILENBQUMsQ0FBQztRQUVOLHNGQUFzRjtRQUN0Rix5RUFBeUU7UUFDekUsc0VBQXNFO1FBQ3RFLE1BQU0sK0JBQStCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5RCwrQkFBK0IsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7WUFDaEUsTUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzQyxJQUFJLEtBQUssRUFBRTtnQkFDVCxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFDcEMsOERBQThEO2dCQUM5RCxJQUFJLEdBQUcsS0FBSyxLQUFLLElBQUksR0FBRyxLQUFLLE9BQU87b0JBQUUsT0FBTyxLQUFLLENBQUM7Z0JBQ25ELElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2xDLDJCQUEyQjtvQkFDM0IsUUFBUSxHQUFHLElBQUksQ0FBQztpQkFDakI7cUJBQU07b0JBQ0wsc0NBQXNDO29CQUN0QyxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2lCQUMvQjthQUNGO1lBQ0QsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3JDLENBQUMsQ0FBQztRQUVGLFNBQVMsMkJBQTJCLENBQ2hDLFVBQWtCLEVBQUUsY0FBc0IsRUFDMUMsZUFBbUM7WUFDckMsT0FBTyxFQUFFLENBQUMsaUJBQWlCLENBQ3ZCLFVBQVUsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDcEYsQ0FBQztRQUVELElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDZCxTQUFTLEdBQUcsSUFBSSx5QkFBWSxDQUN4QixLQUFLLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLDJCQUEyQixDQUFDLENBQUM7U0FDdEY7UUFFRCxJQUFJLFdBQVcsRUFBRTtZQUNmLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdkUsU0FBUyxDQUFDLDJCQUEyQixHQUFHLENBQUMsUUFBZ0IsRUFBRSxFQUFFO2dCQUMzRCw4RkFBOEY7Z0JBQzlGLDRGQUE0RjtnQkFDNUYsNkZBQTZGO2dCQUM3RixzRkFBc0Y7Z0JBQ3RGLE9BQU8sUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsOEJBQThCLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUMzRSxDQUFDLENBQUM7U0FDSDtRQUVELG1GQUFtRjtRQUNuRixzRkFBc0Y7UUFDdEYsdUNBQXVDO1FBQ3ZDLFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLENBQUM7UUFFdEMsdUZBQXVGO1FBQ3ZGLG1GQUFtRjtRQUNuRixpRkFBaUY7UUFDakYsaUZBQWlGO1FBQ2pGLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFO1lBQ3RCLElBQUksU0FBUyxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQUU7Z0JBQ3pDLFlBQVksQ0FBQywwQkFBMEIsR0FBRyxJQUFJLENBQUM7Z0JBQy9DLHVGQUF1RjtnQkFDdkYsdUZBQXVGO2dCQUN2RiwwRkFBMEY7Z0JBQzFGLGlGQUFpRjtnQkFDakYsSUFBSSxXQUFXLEVBQUU7b0JBQ2YsU0FBUyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztpQkFDdEM7YUFDRjtpQkFBTTtnQkFDTCxZQUFZLENBQUMsMEJBQTBCLEdBQUcsS0FBSyxDQUFDO2FBQ2pEO1NBQ0Y7UUFFRCx1RkFBdUY7UUFDdkYsb0ZBQW9GO1FBQ3BGLDRFQUE0RTtRQUM1RSxJQUFJLFlBQVksQ0FBQywwQkFBMEIsRUFBRTtZQUMzQyxTQUFTLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDO1NBQzFDO1FBRUQsTUFBTSxzQkFBc0IsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDO1FBQ3BELFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7WUFDMUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM3QixPQUFPLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDcEM7WUFDRCxPQUFPLHNCQUFzQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDMUQsQ0FBQyxDQUFDO1FBQ0YsTUFBTSw2QkFBNkIsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2pGLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtZQUNoRCxNQUFNLGlCQUFpQixHQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUMsQ0FBQztZQUUvRSwrRUFBK0U7WUFDL0Usd0JBQXdCO1lBQ3hCLG1FQUFtRTtZQUNuRSwwRkFBMEY7WUFDMUYsdUNBQXVDO1lBQ3ZDLElBQUksUUFBUSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFFdkYsZ0VBQWdFO1lBQ2hFLHdGQUF3RjtZQUN4RixrRkFBa0Y7WUFDbEYsNkRBQTZEO1lBQzdELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFekUsSUFBSSxlQUFlO2dCQUNmLFFBQVE7b0JBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixDQUFDO2dCQUMzRixPQUFPLElBQUksQ0FBQztZQUVkLE9BQU8sNkJBQTZCLENBQUMsUUFBUSxDQUFDLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRixDQUFDLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUMsQ0FBQyxDQUFDO1FBQ2pGLG1DQUFtQyxDQUMvQixNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO1FBRW5FLE1BQU0sQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLFFBQWdCLEVBQUUsb0JBQTRCLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUMxRixTQUFTLENBQUMsYUFBYSxFQUN2QixrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxRSxJQUFJLHdCQUF3QixFQUFFO1lBQzVCLHVEQUF1RDtZQUN2RCxpRUFBaUU7WUFDakUsZ0ZBQWdGO1lBQ2hGLG9GQUFvRjtZQUNwRixNQUFNLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxRQUFnQixFQUFFLG9CQUE0QixFQUFFLEVBQUU7Z0JBQzlFLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRSxPQUFPLGtDQUFxQixDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLE9BQU8sQ0FBQztZQUN0RSxDQUFDLENBQUM7U0FDSDtRQUNELHNGQUFzRjtRQUN0Rix3QkFBd0I7UUFDdkIsTUFBYyxDQUFDLHFCQUFxQixHQUFHLENBQUMsWUFBb0IsRUFBRSxFQUFFO1lBQy9ELE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDdkQsT0FBTyxDQUFDLEtBQUssQ0FBQyxnRkFBZ0YsQ0FBQyxDQUFDO1FBQ2xHLENBQUMsQ0FBQztRQUVGLE1BQU0sWUFBWSxHQUFzQixDQUFDLEVBQ3ZDLE9BQU8sRUFDUCxnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULGlCQUFpQixFQUNqQixnQkFBZ0IsRUFDaEIsa0JBQWtCLEdBQUcsRUFBRSxHQUN4QixFQUFFLEVBQUUsQ0FDRCxPQUFPLENBQUMsZUFBZSxDQUNuQixPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUN4RSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRTtZQUNuQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsTUFBTTtZQUNuQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsS0FBSztZQUNqQyxpQkFBaUIsRUFBRSxrQkFBa0IsQ0FBQyxpQkFBaUI7U0FDeEQsQ0FBQyxDQUFDO1FBRVgsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1lBQ3RCLGlCQUFpQixHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FDNUIsOEJBQThCLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN0RTtRQUNELE1BQU0sRUFBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBQyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztZQUMvRCxTQUFTLEVBQUUsS0FBSztZQUNoQixPQUFPLEVBQUUsWUFBWTtZQUNyQixJQUFJLEVBQUUsTUFBTTtZQUNaLFlBQVk7WUFDWix3QkFBd0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1lBQ2xELGlCQUFpQjtTQUNsQixDQUFDLENBQUM7UUFDSCxNQUFNLGlCQUFpQixHQUFHLFVBQWdDLENBQUM7UUFDM0QsSUFBSSxPQUFPLEdBQUcsbUJBQW1CLENBQUM7UUFDbEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7WUFDdkIsSUFBSSxTQUFTLENBQUMsc0JBQXNCLEVBQUU7Z0JBQ3BDLE9BQU8sSUFBSSxPQUFPLENBQUMsbUJBQW1CLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDbkU7WUFDRCxJQUFJLFNBQVMsQ0FBQyxRQUFRLEVBQUU7Z0JBQ3RCLE1BQU0sUUFBUSxHQUFHLDhCQUFpQixDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDakYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ2hEO1NBQ0Y7UUFFRCw0RUFBNEU7UUFDNUUscURBQXFEO1FBQ3JELElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQztRQUU1QyxJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixFQUFFO1lBQ2hDLDBFQUEwRTtZQUMxRSxrREFBa0Q7WUFDbEQsb0JBQW9CLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztTQUM5RjtRQUVELElBQUksU0FBUyxDQUFDLGtCQUFrQixFQUFFO1lBQ2hDLHlFQUF5RTtZQUN6RSw0RUFBNEU7WUFDNUUsYUFBYTtZQUNiLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3pEO1FBRUQsd0VBQXdFO1FBQ3hFLG9EQUFvRDtRQUNwRCxLQUFLLE1BQU0sUUFBUSxJQUFJLGVBQWUsRUFBRTtZQUN0QyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3hDO1FBRUQsT0FBTyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQztJQUNoQyxDQUFDO0lBeFFELDBCQXdRQztJQUVEOzs7OztPQUtHO0lBQ0gsU0FBUyxvQkFBb0IsQ0FDekIsT0FBbUIsRUFBRSxLQUFlLEVBQUUsUUFBa0IsRUFBRSxRQUFnQixFQUMxRSxNQUF1QjtRQUN6QixNQUFNLFNBQVMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzdDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3JDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9DLElBQUksVUFBVSxFQUFFO2dCQUNkLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ25ELElBQUksUUFBUSxFQUFFO29CQUNaLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDcEQsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztvQkFDMUQsTUFBTSxPQUFPLEdBQUcsa0NBQXFCLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDdkQ7YUFDRjtTQUNGO0lBQ0gsQ0FBQztJQUVELFNBQVMsbUJBQW1CLENBQUMsU0FBdUIsRUFBRSxFQUFpQjtRQUNyRSxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDO1lBQ25DLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRUQsU0FBUyx5QkFBeUIsQ0FBQyxRQUFnQjtRQUNqRCxPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxTQUFTLDhCQUE4QixDQUNuQyxPQUEyQixFQUFFLFNBQXVCLEVBQ3BELFNBQXFCO1FBQ3ZCLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUUzQyx3RkFBd0Y7UUFDeEYsSUFBSSxhQUFhLEdBQUcsZ0JBQVMsQ0FBQyxXQUFXLENBQUM7UUFDMUMsSUFBSSxTQUFTLFlBQVksRUFBRSxDQUFDLFlBQVksRUFBRTtZQUN4QyxhQUFhLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLGdCQUFTLENBQUMscUJBQXFCLENBQUMsQ0FBQztTQUN4RjtRQUNELE1BQU0sV0FBVyxHQUFvQyxFQUFFLENBQUM7UUFDeEQsbUVBQW1FO1FBQ25FLDhEQUE4RDtRQUM5RCxvRUFBb0U7UUFDcEUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7UUFDdkQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7UUFDdEQsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9GLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzVDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQix5REFBeUQ7WUFDekQsK0JBQStCO1lBQy9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDM0Q7UUFFRCxJQUFJLFNBQVMsWUFBWSxFQUFFLENBQUMsWUFBWSxFQUFFO1lBQ3hDLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUN0RDtRQUVELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ3ZCLGdFQUFnRTtZQUNoRSxzQkFBc0I7WUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7WUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7U0FDM0Q7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2hEO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILFNBQWdCLG1DQUFtQyxDQUMvQyxNQUF1QixFQUFFLFlBQWdDLEVBQUUsU0FBdUIsRUFDbEYsNEJBQXFDO1FBQ3ZDLE1BQU0seUJBQXlCLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFDNUQsTUFBTSxDQUFDLG9CQUFvQixHQUFHLENBQUMsZ0JBQXdCLEVBQUUsa0JBQTJCLEVBQUUsRUFBRTtZQUN0RixNQUFNLFFBQVEsR0FBRyxHQUFHLGdCQUFnQixJQUFJLGtCQUFrQixFQUFFLENBQUM7WUFDN0Qsb0VBQW9FO1lBQ3BFLDJEQUEyRDtZQUMzRCx3REFBd0Q7WUFDeEQscUVBQXFFO1lBQ3JFLElBQUkseUJBQXlCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUMzQyxPQUFPLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNoRDtZQUNELE1BQU0sTUFBTSxHQUFHLHNCQUFzQixDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDNUUseUJBQXlCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNoRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDLENBQUM7UUFFRixTQUFTLHNCQUFzQixDQUFDLGdCQUF3QixFQUFFLGtCQUEyQjtZQUNuRixNQUFNLGtCQUFrQixHQUNwQixrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNqRixNQUFNLGtCQUFrQixHQUFHLEdBQUcsU0FBUyxDQUFDLGFBQWEsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQzlFLElBQUksNEJBQTRCLEtBQUssSUFBSSxFQUFFO2dCQUN6QyxPQUFPLGtCQUFrQixDQUFDO2FBQzNCO1lBRUQsd0ZBQXdGO1lBQ3hGLHdGQUF3RjtZQUN4Rix5RkFBeUY7WUFDekYsK0NBQStDO1lBQy9DLElBQUk7Z0JBQ0YsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsRixJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFO29CQUN2QyxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUM7aUJBQzlCO2FBQ0Y7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWiw2RUFBNkU7Z0JBQzdFLCtDQUErQzthQUNoRDtZQUVELHlGQUF5RjtZQUN6RixxREFBcUQ7WUFDckQsdURBQXVEO1lBQ3ZELG1GQUFtRjtZQUNuRixzRUFBc0U7WUFDdEUsMEZBQTBGO1lBQzFGLDZFQUE2RTtZQUM3RSxtREFBbUQ7WUFDbkQsd0RBQXdEO1lBQ3hELGdDQUFnQztZQUNoQywyQ0FBMkM7WUFDM0Msd0RBQXdEO1lBQ3hELDJFQUEyRTtZQUMzRSxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pELE1BQU0saUJBQWlCLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQztnQkFDL0UsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7b0JBQ3BDLE1BQU0sVUFBVSxHQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBRSxFQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUMsQ0FBQyxDQUVqRSxDQUFDLFFBQVEsQ0FBQztvQkFDL0IsSUFBSSxVQUFVLEVBQUU7d0JBQ2QsT0FBTyxVQUFVLENBQUM7cUJBQ25CO2lCQUNGO2FBQ0Y7WUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO2dCQUN4RixNQUFNLENBQUMsYUFBYSxFQUFFO2dCQUN4QixPQUFPLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQWtCLENBQUMsQ0FBQzthQUM1RTtZQUVELDZGQUE2RjtZQUM3Rix5RkFBeUY7WUFDekYsOEJBQThCO1lBQzlCLG1GQUFtRjtZQUNuRixzRkFBc0Y7WUFDdEYsd0ZBQXdGO1lBQ3hGLDJGQUEyRjtZQUMzRiw4REFBOEQ7WUFDOUQsOEZBQThGO1lBQzlGLDBEQUEwRDtZQUMxRCwyRkFBMkY7WUFDM0YsNEZBQTRGO1lBQzVGLHNFQUFzRTtZQUN0RSxvRkFBb0Y7WUFDcEYsSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQy9DLE9BQU8sa0JBQWtCLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUN2RDtpQkFBTSxJQUNILGtCQUFrQixJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtnQkFDNUYsT0FBTyxrQkFBa0IsQ0FBQzthQUMzQjtZQUNELE1BQU0saUJBQWlCLEdBQ25CLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDaEYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3RGLE9BQU8sa0JBQWtCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxrQkFBa0IsRUFBRSxDQUFDO1FBQzdGLENBQUM7SUFDSCxDQUFDO0lBL0ZELGtGQStGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtQZXJmUGhhc2V9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcGVyZic7XG5pbXBvcnQge0JhemVsT3B0aW9ucywgQ2FjaGVkRmlsZUxvYWRlciwgQ29tcGlsZXJIb3N0LCBjb25zdHJ1Y3RNYW5pZmVzdCwgZGVidWcsIEZpbGVDYWNoZSwgRmlsZUxvYWRlciwgcGFyc2VUc2NvbmZpZywgcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoLCBydW5Bc1dvcmtlciwgcnVuV29ya2VyTG9vcCwgVW5jYWNoZWRGaWxlTG9hZGVyfSBmcm9tICdAYmF6ZWwvdHlwZXNjcmlwdCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHNpY2tsZSBmcm9tICd0c2lja2xlJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5jb25zdCBFWFQgPSAvKFxcLnRzfFxcLmRcXC50c3xcXC5qc3xcXC5qc3h8XFwudHN4KSQvO1xuY29uc3QgTkdDX0dFTl9GSUxFUyA9IC9eKC4qPylcXC4obmdmYWN0b3J5fG5nc3VtbWFyeXxuZ3N0eWxlfHNoaW1cXC5uZ3N0eWxlKSguKikkLztcbi8vIEZJWE1FOiB3ZSBzaG91bGQgYmUgYWJsZSB0byBhZGQgdGhlIGFzc2V0cyB0byB0aGUgdHNjb25maWcgc28gRmlsZUxvYWRlclxuLy8ga25vd3MgYWJvdXQgdGhlbVxuY29uc3QgTkdDX0FTU0VUUyA9IC9cXC4oY3NzfGh0bWx8bmdzdW1tYXJ5XFwuanNvbikkLztcblxuY29uc3QgQkFaRUxfQklOID0gL1xcYihibGF6ZXxiYXplbCktb3V0XFxiLio/XFxiYmluXFxiLztcblxuLy8gTm90ZTogV2UgY29tcGlsZSB0aGUgY29udGVudCBvZiBub2RlX21vZHVsZXMgd2l0aCBwbGFpbiBuZ2MgY29tbWFuZCBsaW5lLlxuY29uc3QgQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCA9IGZhbHNlO1xuXG5jb25zdCBOT0RFX01PRFVMRVMgPSAnbm9kZV9tb2R1bGVzLyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWluKGFyZ3MpIHtcbiAgaWYgKHJ1bkFzV29ya2VyKGFyZ3MpKSB7XG4gICAgcnVuV29ya2VyTG9vcChydW5PbmVCdWlsZCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHJ1bk9uZUJ1aWxkKGFyZ3MpID8gMCA6IDE7XG4gIH1cbiAgcmV0dXJuIDA7XG59XG5cbi8qKiBUaGUgb25lIEZpbGVDYWNoZSBpbnN0YW5jZSB1c2VkIGluIHRoaXMgcHJvY2Vzcy4gKi9cbmNvbnN0IGZpbGVDYWNoZSA9IG5ldyBGaWxlQ2FjaGU8dHMuU291cmNlRmlsZT4oZGVidWcpO1xuXG5leHBvcnQgZnVuY3Rpb24gcnVuT25lQnVpbGQoYXJnczogc3RyaW5nW10sIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSk6IGJvb2xlYW4ge1xuICBpZiAoYXJnc1swXSA9PT0gJy1wJykgYXJncy5zaGlmdCgpO1xuICAvLyBTdHJpcCBsZWFkaW5nIGF0LXNpZ25zLCB1c2VkIHRvIGluZGljYXRlIGEgcGFyYW1zIGZpbGVcbiAgY29uc3QgcHJvamVjdCA9IGFyZ3NbMF0ucmVwbGFjZSgvXkArLywgJycpO1xuXG4gIGNvbnN0IFtwYXJzZWRPcHRpb25zLCBlcnJvcnNdID0gcGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB7YmF6ZWxPcHRzLCBvcHRpb25zOiB0c09wdGlvbnMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3Qge2Vycm9yczogdXNlckVycm9ycywgb3B0aW9uczogdXNlck9wdGlvbnN9ID0gbmcucmVhZENvbmZpZ3VyYXRpb24ocHJvamVjdCk7XG5cbiAgaWYgKHVzZXJFcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3ModXNlckVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcyA9IG5ldyBTZXQ8c3RyaW5nPihbXG4gICAgJ2RpYWdub3N0aWNzJyxcbiAgICAndHJhY2UnLFxuICAgICdkaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nJyxcbiAgICAnZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2snLFxuICAgICdpMThuT3V0TG9jYWxlJyxcbiAgICAnaTE4bk91dEZvcm1hdCcsXG4gICAgJ2kxOG5PdXRGaWxlJyxcbiAgICAnaTE4bkluTG9jYWxlJyxcbiAgICAnaTE4bkluRmlsZScsXG4gICAgJ2kxOG5JbkZvcm1hdCcsXG4gICAgJ2kxOG5Vc2VFeHRlcm5hbElkcycsXG4gICAgJ2kxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMnLFxuICAgICdwcmVzZXJ2ZVdoaXRlc3BhY2VzJyxcbiAgICAnY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwge30pO1xuXG4gIGNvbnN0IGNvbXBpbGVyT3B0czogbmcuQW5ndWxhckNvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICAuLi51c2VyT3ZlcnJpZGVzLFxuICAgIC4uLmNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddLFxuICAgIC4uLnRzT3B0aW9ucyxcbiAgfTtcblxuICAvLyBUaGVzZSBhcmUgb3B0aW9ucyBwYXNzZWQgdGhyb3VnaCBmcm9tIHRoZSBgbmdfbW9kdWxlYCBydWxlIHdoaWNoIGFyZW4ndCBzdXBwb3J0ZWRcbiAgLy8gYnkgdGhlIGBAYW5ndWxhci9jb21waWxlci1jbGlgIGFuZCBhcmUgb25seSBpbnRlbmRlZCBmb3IgYG5nYy13cmFwcGVkYC5cbiAgY29uc3Qge2V4cGVjdGVkT3V0LCBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZX0gPSBjb25maWdbJ2FuZ3VsYXJDb21waWxlck9wdGlvbnMnXTtcblxuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgICBleHBlY3RlZE91dHM6IGV4cGVjdGVkT3V0LFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICB0c0hvc3QsXG4gICAgYmF6ZWxPcHRzLFxuICAgIGZpbGVzLFxuICAgIGlucHV0cyxcbiAgfSk7XG4gIGlmIChkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGRpYWdub3N0aWNzKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzLmV2ZXJ5KGQgPT4gZC5jYXRlZ29yeSAhPT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlUGF0aDogc3RyaW5nLCByb290RGlyczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gZmlsZVBhdGg7XG4gIC8vIE5COiB0aGUgcm9vdERpcnMgc2hvdWxkIGhhdmUgYmVlbiBzb3J0ZWQgbG9uZ2VzdC1maXJzdFxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3REaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZGlyID0gcm9vdERpcnNbaV07XG4gICAgY29uc3QgcmVsID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShkaXIsIGZpbGVQYXRoKTtcbiAgICBpZiAocmVsLmluZGV4T2YoJy4nKSAhPSAwKSByZXR1cm4gcmVsO1xuICB9XG4gIHJldHVybiBmaWxlUGF0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGUoe1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwgPSB0cnVlLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICBjb21waWxlck9wdHMsXG4gIHRzSG9zdCxcbiAgYmF6ZWxPcHRzLFxuICBmaWxlcyxcbiAgaW5wdXRzLFxuICBleHBlY3RlZE91dHMsXG4gIGdhdGhlckRpYWdub3N0aWNzLFxuICBiYXplbEhvc3Rcbn06IHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsPzogYm9vbGVhbixcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZT86IGJvb2xlYW4sIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLCB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCxcbiAgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICAgICAgZmlsZXM6IHN0cmluZ1tdLFxuICAgICAgICBleHBlY3RlZE91dHM6IHN0cmluZ1tdLFxuICBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiBuZy5EaWFnbm9zdGljcyxcbiAgYmF6ZWxIb3N0PzogQ29tcGlsZXJIb3N0LFxufSk6IHtkaWFnbm9zdGljczogbmcuRGlhZ25vc3RpY3MsIHByb2dyYW06IG5nLlByb2dyYW19IHtcbiAgbGV0IGZpbGVMb2FkZXI6IEZpbGVMb2FkZXI7XG5cbiAgaWYgKGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbWF4Q2FjaGVTaXplQnl0ZXMgPSBiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgKiAoMSA8PCAyMCk7XG4gICAgZmlsZUNhY2hlLnNldE1heENhY2hlU2l6ZShtYXhDYWNoZVNpemVCeXRlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUNhY2hlLnJlc2V0TWF4Q2FjaGVTaXplKCk7XG4gIH1cblxuICBpZiAoaW5wdXRzKSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBDYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzLnNldChyZXNvbHZlTm9ybWFsaXplZFBhdGgoa2V5KSwgaW5wdXRzW2tleV0pO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICAvLyBEZXRlY3QgZnJvbSBjb21waWxlck9wdHMgd2hldGhlciB0aGUgZW50cnlwb2ludCBpcyBiZWluZyBpbnZva2VkIGluIEl2eSBtb2RlLlxuICBjb25zdCBpc0luSXZ5TW9kZSA9ICEhY29tcGlsZXJPcHRzLmVuYWJsZUl2eTtcbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0c1NldCA9IG5ldyBTZXQoZXhwZWN0ZWRPdXRzLm1hcChwID0+IGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgocCkpKTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPVxuICAgICAgICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZU5hbWUpLCBbY29tcGlsZXJPcHRzLnJvb3REaXJdKTtcbiAgICAgICAgaWYgKGV4cGVjdGVkT3V0c1NldC5oYXMocmVsYXRpdmUpKSB7XG4gICAgICAgICAgZXhwZWN0ZWRPdXRzU2V0LmRlbGV0ZShyZWxhdGl2ZSk7XG4gICAgICAgICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gIC8vIFBhdGNoIGZpbGVFeGlzdHMgd2hlbiByZXNvbHZpbmcgbW9kdWxlcywgc28gdGhhdCBDb21waWxlckhvc3QgY2FuIGFzayBUeXBlU2NyaXB0IHRvXG4gIC8vIHJlc29sdmUgbm9uLWV4aXN0aW5nIGdlbmVyYXRlZCBmaWxlcyB0aGF0IGRvbid0IGV4aXN0IG9uIGRpc2ssIGJ1dCBhcmVcbiAgLy8gc3ludGhldGljIGFuZCBhZGRlZCB0byB0aGUgYHByb2dyYW1XaXRoU3R1YnNgIGJhc2VkIG9uIHJlYWwgaW5wdXRzLlxuICBjb25zdCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0ID0gT2JqZWN0LmNyZWF0ZSh0c0hvc3QpO1xuICBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gTkdDX0dFTl9GSUxFUy5leGVjKGZpbGVOYW1lKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFssIGZpbGUsIHN1ZmZpeCwgZXh0XSA9IG1hdGNoO1xuICAgICAgLy8gUGVyZm9ybWFuY2U6IHNraXAgbG9va2luZyBmb3IgZmlsZXMgb3RoZXIgdGhhbiAuZC50cyBvciAudHNcbiAgICAgIGlmIChleHQgIT09ICcudHMnICYmIGV4dCAhPT0gJy5kLnRzJykgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1ZmZpeC5pbmRleE9mKCduZ3N0eWxlJykgPj0gMCkge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uY3NzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmQudHMgb3IgZm9vLnRzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlICsgKGV4dCB8fCAnJyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKFxuICAgICAgbW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZTogc3RyaW5nLFxuICAgICAgY29tcGlsZXJPcHRpb25zOiB0cy5Db21waWxlck9wdGlvbnMpOiB0cy5SZXNvbHZlZE1vZHVsZVdpdGhGYWlsZWRMb29rdXBMb2NhdGlvbnMge1xuICAgIHJldHVybiB0cy5yZXNvbHZlTW9kdWxlTmFtZShcbiAgICAgICAgbW9kdWxlTmFtZSwgY29udGFpbmluZ0ZpbGUsIGNvbXBpbGVyT3B0aW9ucywgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCk7XG4gIH1cblxuICBpZiAoIWJhemVsSG9zdCkge1xuICAgIGJhemVsSG9zdCA9IG5ldyBDb21waWxlckhvc3QoXG4gICAgICAgIGZpbGVzLCBjb21waWxlck9wdHMsIGJhemVsT3B0cywgdHNIb3N0LCBmaWxlTG9hZGVyLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIpO1xuICB9XG5cbiAgaWYgKGlzSW5JdnlNb2RlKSB7XG4gICAgY29uc3QgZGVsZWdhdGUgPSBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nLmJpbmQoYmF6ZWxIb3N0KTtcbiAgICBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIC8vIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIHNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZyBjaGVja3Mgd2hldGhlciBgZmlsZU5hbWVgIGlzIHBhcnQgb2ZcbiAgICAgIC8vIHRoZSBvcmlnaW5hbCBgc3Jjc1tdYC4gRm9yIEFuZ3VsYXIgKEl2eSkgY29tcGlsYXRpb25zLCBuZ2ZhY3RvcnkvbmdzdW1tYXJ5IGZpbGVzIHRoYXQgYXJlXG4gICAgICAvLyBzaGltcyBmb3Igb3JpZ2luYWwgLnRzIGZpbGVzIGluIHRoZSBwcm9ncmFtIHNob3VsZCBiZSB0cmVhdGVkIGlkZW50aWNhbGx5LiBUaHVzLCBzdHJpcCB0aGVcbiAgICAgIC8vICcubmdmYWN0b3J5JyBvciAnLm5nc3VtbWFyeScgcGFydCBvZiB0aGUgZmlsZW5hbWUgYXdheSBiZWZvcmUgY2FsbGluZyB0aGUgZGVsZWdhdGUuXG4gICAgICByZXR1cm4gZGVsZWdhdGUoZmlsZU5hbWUucmVwbGFjZSgvXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnkpXFwudHMkLywgJy50cycpKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQnkgZGVmYXVsdCwgZGlzYWJsZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm1pbmcgaW4gdGhlIHRzaWNrbGUgY29tcGlsZXIgaG9zdC5cbiAgLy8gVGhlIEFuZ3VsYXIgY29tcGlsZXJzIGhhdmUgdGhlaXIgb3duIGxvZ2ljIGZvciBkZWNvcmF0b3IgcHJvY2Vzc2luZyBhbmQgd2Ugd291bGRuJ3RcbiAgLy8gd2FudCB0c2lja2xlIHRvIGludGVyZmVyZSB3aXRoIHRoYXQuXG4gIGJhemVsSG9zdC50cmFuc2Zvcm1EZWNvcmF0b3JzID0gZmFsc2U7XG5cbiAgLy8gQnkgZGVmYXVsdCBpbiB0aGUgYHByb2Rtb2RlYCBvdXRwdXQsIHdlIGRvIG5vdCBhZGQgYW5ub3RhdGlvbnMgZm9yIGNsb3N1cmUgY29tcGlsZXIuXG4gIC8vIFRob3VnaCwgaWYgd2UgYXJlIGJ1aWxkaW5nIGluc2lkZSBgZ29vZ2xlM2AsIGNsb3N1cmUgYW5ub3RhdGlvbnMgYXJlIGRlc2lyZWQgZm9yXG4gIC8vIHByb2Rtb2RlIG91dHB1dCwgc28gd2UgZW5hYmxlIGl0IGJ5IGRlZmF1bHQuIFRoZSBkZWZhdWx0cyBjYW4gYmUgb3ZlcnJpZGRlbiBieVxuICAvLyBzZXR0aW5nIHRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIGNvbXBpbGVyIG9wdGlvbiBpbiB0aGUgdXNlciB0c2NvbmZpZy5cbiAgaWYgKCFiYXplbE9wdHMuZXM1TW9kZSkge1xuICAgIGlmIChiYXplbE9wdHMud29ya3NwYWNlTmFtZSA9PT0gJ2dvb2dsZTMnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgICAgLy8gRW5hYmxlIHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0gaW4gZ29vZ2xlMyB3aXRoIEl2eSBtb2RlIGVuYWJsZWQuIFRoZSB0c2lja2xlXG4gICAgICAvLyBkZWNvcmF0b3IgdHJhbnNmb3JtYXRpb24gaXMgc3RpbGwgbmVlZGVkLiBUaGlzIG1pZ2h0IGJlIGJlY2F1c2Ugb2YgY3VzdG9tIGRlY29yYXRvcnNcbiAgICAgIC8vIHdpdGggdGhlIGBAQW5ub3RhdGlvbmAgSlNEb2MgdGhhdCB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtLlxuICAgICAgLy8gVE9ETzogRmlndXJlIG91dCB3aHkgdGhpcyBpcyBuZWVkZWQgaW4gZzMgYW5kIGhvdyB3ZSBjYW4gaW1wcm92ZSB0aGlzLiBGVy0yMjI1XG4gICAgICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAgICAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBBbmd1bGFyIGNvbXBpbGVyIG9wdGlvbiBpcyBub3QgcmVzcGVjdGVkIGJ5IGRlZmF1bHRcbiAgLy8gYXMgbmdjLXdyYXBwZWQgaGFuZGxlcyB0c2lja2xlIGVtaXQgb24gaXRzIG93bi4gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gdXBkYXRlXG4gIC8vIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QgYmFzZWQgb24gdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgZmxhZy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gIH1cblxuICBjb25zdCBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0ID0gYmF6ZWxIb3N0LmZpbGVFeGlzdHM7XG4gIGJhemVsSG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoTkdDX0FTU0VUUy50ZXN0KGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RGaWxlRXhpc3QuY2FsbChiYXplbEhvc3QsIGZpbGVOYW1lKTtcbiAgfTtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUgPSBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZS5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBmbGF0TW9kdWxlT3V0UGF0aCA9XG4gICAgICAgIHBhdGgucG9zaXguam9pbihiYXplbE9wdHMucGFja2FnZSwgY29tcGlsZXJPcHRzLmZsYXRNb2R1bGVPdXRGaWxlICsgJy50cycpO1xuXG4gICAgLy8gVGhlIGJ1bmRsZSBpbmRleCBmaWxlIGlzIHN5bnRoZXNpemVkIGluIGJ1bmRsZV9pbmRleF9ob3N0IHNvIGl0J3Mgbm90IGluIHRoZVxuICAgIC8vIGNvbXBpbGF0aW9uVGFyZ2V0U3JjLlxuICAgIC8vIEhvd2V2ZXIgd2Ugc3RpbGwgd2FudCB0byBnaXZlIGl0IGFuIEFNRCBtb2R1bGUgbmFtZSBmb3IgZGV2bW9kZS5cbiAgICAvLyBXZSBjYW4ndCBlYXNpbHkgdGVsbCB3aGljaCBmaWxlIGlzIHRoZSBzeW50aGV0aWMgb25lLCBzbyB3ZSBidWlsZCB1cCB0aGUgcGF0aCB3ZSBleHBlY3RcbiAgICAvLyBpdCB0byBoYXZlIGFuZCBjb21wYXJlIGFnYWluc3QgdGhhdC5cbiAgICBpZiAoZmlsZU5hbWUgPT09IHBhdGgucG9zaXguam9pbihjb21waWxlck9wdHMuYmFzZVVybCwgZmxhdE1vZHVsZU91dFBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEFsc28gaGFuZGxlIHRoZSBjYXNlIHRoZSB0YXJnZXQgaXMgaW4gYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeS5cbiAgICAvLyBQdWxsIHRoZSB3b3Jrc3BhY2UgbmFtZSBmcm9tIHRoZSB0YXJnZXQgd2hpY2ggaXMgZm9ybWF0dGVkIGFzIGBAd2tzcC8vcGFja2FnZTp0YXJnZXRgXG4gICAgLy8gaWYgaXQgdGhlIHRhcmdldCBpcyBmcm9tIGFuIGV4dGVybmFsIHdvcmtzcGFjZS4gSWYgdGhlIHRhcmdldCBpcyBmcm9tIHRoZSBsb2NhbFxuICAgIC8vIHdvcmtzcGFjZSB0aGVuIGl0IHdpbGwgYmUgZm9ybWF0dGVkIGFzIGAvL3BhY2thZ2U6dGFyZ2V0YC5cbiAgICBjb25zdCB0YXJnZXRXb3Jrc3BhY2UgPSBiYXplbE9wdHMudGFyZ2V0LnNwbGl0KCcvJylbMF0ucmVwbGFjZSgvXkAvLCAnJyk7XG5cbiAgICBpZiAodGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICAgIGZpbGVOYW1lID09PVxuICAgICAgICAgICAgcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCAnZXh0ZXJuYWwnLCB0YXJnZXRXb3Jrc3BhY2UsIGZsYXRNb2R1bGVPdXRQYXRoKSlcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlKGZpbGVOYW1lKSB8fCBOR0NfR0VOX0ZJTEVTLnRlc3QoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGNvbnN0IG5nSG9zdCA9IG5nLmNyZWF0ZUNvbXBpbGVySG9zdCh7b3B0aW9uczogY29tcGlsZXJPcHRzLCB0c0hvc3Q6IGJhemVsSG9zdH0pO1xuICBwYXRjaE5nSG9zdFdpdGhGaWxlTmFtZVRvTW9kdWxlTmFtZShcbiAgICAgIG5nSG9zdCwgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUpO1xuXG4gIG5nSG9zdC50b1N1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSA9PiBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZSwgY29tcGlsZXJPcHRzLnJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpKTtcbiAgaWYgKGFsbERlcHNDb21waWxlZFdpdGhCYXplbCkge1xuICAgIC8vIE5vdGU6IFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCxcbiAgICAvLyBidXQgd2UgY2FuIGJlIGZhc3RlciBhcyB3ZSBrbm93IGhvdyBgdG9TdW1tYXJ5RmlsZU5hbWVgIHdvcmtzLlxuICAgIC8vIE5vdGU6IFdlIGNhbid0IGRvIHRoaXMgaWYgc29tZSBkZXBzIGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIHRoZSBjb21tYW5kIGxpbmUsXG4gICAgLy8gYXMgdGhhdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgZnJvbVN1bW1hcnlGaWxlTmFtZSAvIHRvU3VtbWFyeUZpbGVOYW1lXG4gICAgbmdIb3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBmaWxlTmFtZS5zcGxpdCgnLycpLnNwbGljZSgxKS5qb2luKCcvJyk7XG4gICAgICByZXR1cm4gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCB3b3Jrc3BhY2VSZWxhdGl2ZSkgKyAnLmQudHMnO1xuICAgIH07XG4gIH1cbiAgLy8gUGF0Y2ggYSBwcm9wZXJ0eSBvbiB0aGUgbmdIb3N0IHRoYXQgYWxsb3dzIHRoZSByZXNvdXJjZU5hbWVUb01vZHVsZU5hbWUgZnVuY3Rpb24gdG9cbiAgLy8gcmVwb3J0IGJldHRlciBlcnJvcnMuXG4gIChuZ0hvc3QgYXMgYW55KS5yZXBvcnRNaXNzaW5nUmVzb3VyY2UgPSAocmVzb3VyY2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGBcXG5Bc3NldCBub3QgZm91bmQ6XFxuICAke3Jlc291cmNlTmFtZX1gKTtcbiAgICBjb25zb2xlLmVycm9yKCdDaGVjayB0aGF0IGl0XFwncyBpbmNsdWRlZCBpbiB0aGUgYGFzc2V0c2AgYXR0cmlidXRlIG9mIHRoZSBgbmdfbW9kdWxlYCBydWxlLlxcbicpO1xuICB9O1xuXG4gIGNvbnN0IGVtaXRDYWxsYmFjazogbmcuVHNFbWl0Q2FsbGJhY2sgPSAoe1xuICAgIHByb2dyYW0sXG4gICAgdGFyZ2V0U291cmNlRmlsZSxcbiAgICB3cml0ZUZpbGUsXG4gICAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gICAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgfSkgPT5cbiAgICAgIHRzaWNrbGUuZW1pdFdpdGhUc2lja2xlKFxuICAgICAgICAgIHByb2dyYW0sIGJhemVsSG9zdCwgYmF6ZWxIb3N0LCBjb21waWxlck9wdHMsIHRhcmdldFNvdXJjZUZpbGUsIHdyaXRlRmlsZSxcbiAgICAgICAgICBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywge1xuICAgICAgICAgICAgYmVmb3JlVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5iZWZvcmUsXG4gICAgICAgICAgICBhZnRlclRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXIsXG4gICAgICAgICAgICBhZnRlckRlY2xhcmF0aW9uczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyRGVjbGFyYXRpb25zLFxuICAgICAgICAgIH0pO1xuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0pO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oe1xuICAgIHJvb3ROYW1lczogZmlsZXMsXG4gICAgb3B0aW9uczogY29tcGlsZXJPcHRzLFxuICAgIGhvc3Q6IG5nSG9zdCxcbiAgICBlbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrOiB0c2lja2xlLm1lcmdlRW1pdFJlc3VsdHMsXG4gICAgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoIWJhemVsT3B0cy5ub2RlTW9kdWxlc1ByZWZpeCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIG5vZGUgbW9kdWxlcywgdGhlbiBtZXRhZGF0YS5qc29uIHNob3VsZCBiZSBlbWl0dGVkIHNpbmNlXG4gICAgLy8gdGhlcmUgaXMgbm8gb3RoZXIgd2F5IHRvIG9idGFpbiB0aGUgaW5mb3JtYXRpb25cbiAgICBnZW5lcmF0ZU1ldGFkYXRhSnNvbihwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCBmaWxlcywgY29tcGlsZXJPcHRzLnJvb3REaXJzLCBiYXplbEJpbiwgdHNIb3N0KTtcbiAgfVxuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIC8vIFRoZXJlIG1pZ2h0IGJlIHNvbWUgZXhwZWN0ZWQgb3V0cHV0IGZpbGVzIHRoYXQgYXJlIG5vdCB3cml0dGVuIGJ5IHRoZVxuICAvLyBjb21waWxlci4gSW4gdGhpcyBjYXNlLCBqdXN0IHdyaXRlIGFuIGVtcHR5IGZpbGUuXG4gIGZvciAoY29uc3QgZmlsZU5hbWUgb2YgZXhwZWN0ZWRPdXRzU2V0KSB7XG4gICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsICcnLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBtZXRhZGF0YS5qc29uIGZvciB0aGUgc3BlY2lmaWVkIGBmaWxlc2AuIEJ5IGRlZmF1bHQsIG1ldGFkYXRhLmpzb25cbiAqIGlzIG9ubHkgZ2VuZXJhdGVkIGJ5IHRoZSBjb21waWxlciBpZiAtLWZsYXRNb2R1bGVPdXRGaWxlIGlzIHNwZWNpZmllZC4gQnV0XG4gKiBpZiBjb21waWxlZCB1bmRlciBibGF6ZSwgd2Ugd2FudCB0aGUgbWV0YWRhdGEgdG8gYmUgZ2VuZXJhdGVkIGZvciBlYWNoXG4gKiBBbmd1bGFyIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVNZXRhZGF0YUpzb24oXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgZmlsZXM6IHN0cmluZ1tdLCByb290RGlyczogc3RyaW5nW10sIGJhemVsQmluOiBzdHJpbmcsXG4gICAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QpIHtcbiAgY29uc3QgY29sbGVjdG9yID0gbmV3IG5nLk1ldGFkYXRhQ29sbGVjdG9yKCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoc291cmNlRmlsZSkge1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBjb2xsZWN0b3IuZ2V0TWV0YWRhdGEoc291cmNlRmlsZSk7XG4gICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZSwgcm9vdERpcnMpO1xuICAgICAgICBjb25zdCBzaG9ydFBhdGggPSByZWxhdGl2ZS5yZXBsYWNlKEVYVCwgJy5tZXRhZGF0YS5qc29uJyk7XG4gICAgICAgIGNvbnN0IG91dEZpbGUgPSByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHNob3J0UGF0aCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSk7XG4gICAgICAgIHRzSG9zdC53cml0ZUZpbGUob3V0RmlsZSwgZGF0YSwgZmFsc2UsIHVuZGVmaW5lZCwgW10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIU5HQ19HRU5fRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiZcbiAgICAgIChiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZpbGVQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICAgIG9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtKTogKG5nLkRpYWdub3N0aWN8dHMuRGlhZ25vc3RpYylbXSB7XG4gIGNvbnN0IHRzUHJvZ3JhbSA9IG5nUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcblxuICAvLyBGb3IgdGhlIEl2eSBjb21waWxlciwgdHJhY2sgdGhlIGFtb3VudCBvZiB0aW1lIHNwZW50IGZldGNoaW5nIFR5cGVTY3JpcHQgZGlhZ25vc3RpY3MuXG4gIGxldCBwcmV2aW91c1BoYXNlID0gUGVyZlBoYXNlLlVuYWNjb3VudGVkO1xuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgcHJldmlvdXNQaGFzZSA9IG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UoUGVyZlBoYXNlLlR5cGVTY3JpcHREaWFnbm9zdGljcyk7XG4gIH1cbiAgY29uc3QgZGlhZ25vc3RpY3M6IChuZy5EaWFnbm9zdGljfHRzLkRpYWdub3N0aWMpW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoZiA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgfVxuXG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKHByZXZpb3VzUGhhc2UpO1xuICB9XG5cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBwcm9jZXNzLmV4aXRDb2RlID0gbWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpO1xufVxuXG4vKipcbiAqIEFkZHMgc3VwcG9ydCBmb3IgdGhlIG9wdGlvbmFsIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgb3BlcmF0aW9uIHRvIGEgZ2l2ZW4gYG5nLkNvbXBpbGVySG9zdGAuXG4gKlxuICogVGhpcyBpcyB1c2VkIHdpdGhpbiBgbmdjLXdyYXBwZWRgIGFuZCB0aGUgQmF6ZWwgY29tcGlsYXRpb24gZmxvdywgYnV0IGlzIGV4cG9ydGVkIGhlcmUgdG8gYWxsb3dcbiAqIGZvciBvdGhlciBjb25zdW1lcnMgb2YgdGhlIGNvbXBpbGVyIHRvIGFjY2VzcyB0aGlzIHNhbWUgbG9naWMuIEZvciBleGFtcGxlLCB0aGUgeGkxOG4gb3BlcmF0aW9uXG4gKiBpbiBnMyBjb25maWd1cmVzIGl0cyBvd24gYG5nLkNvbXBpbGVySG9zdGAgd2hpY2ggYWxzbyByZXF1aXJlcyBgZmlsZU5hbWVUb01vZHVsZU5hbWVgIHRvIHdvcmtcbiAqIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICAgIG5nSG9zdDogbmcuQ29tcGlsZXJIb3N0LCBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgbmdIb3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lID0gKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBgJHtpbXBvcnRlZEZpbGVQYXRofToke2NvbnRhaW5pbmdGaWxlUGF0aH1gO1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhjYWNoZUtleSkpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmdldChjYWNoZUtleSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCwgY29udGFpbmluZ0ZpbGVQYXRoKTtcbiAgICBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLnNldChjYWNoZUtleSwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlbGF0aXZlVGFyZ2V0UGF0aCA9XG4gICAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgY29uc3QgbWFuaWZlc3RUYXJnZXRQYXRoID0gYCR7YmF6ZWxPcHRzLndvcmtzcGFjZU5hbWV9LyR7cmVsYXRpdmVUYXJnZXRQYXRofWA7XG4gICAgaWYgKHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBtYW5pZmVzdFRhcmdldFBhdGg7XG4gICAgfVxuXG4gICAgLy8gVW5sZXNzIG1hbmlmZXN0IHBhdGhzIGFyZSBleHBsaWNpdGx5IGVuZm9yY2VkLCB3ZSBpbml0aWFsbHkgY2hlY2sgaWYgYSBtb2R1bGUgbmFtZSBpc1xuICAgIC8vIHNldCBmb3IgdGhlIGdpdmVuIHNvdXJjZSBmaWxlLiBUaGUgY29tcGlsZXIgaG9zdCBmcm9tIGBAYmF6ZWwvdHlwZXNjcmlwdGAgc2V0cyBzb3VyY2VcbiAgICAvLyBmaWxlIG1vZHVsZSBuYW1lcyBpZiB0aGUgY29tcGlsYXRpb24gdGFyZ2V0cyBlaXRoZXIgVU1EIG9yIEFNRC4gVG8gZW5zdXJlIHRoYXQgdGhlIEFNRFxuICAgIC8vIG1vZHVsZSBuYW1lcyBtYXRjaCwgd2UgZmlyc3QgY29uc2lkZXIgdGhvc2UuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IChKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpIGFzIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1wb3J0QXM6IHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuaW1wb3J0QXM7XG4gICAgICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG1vZHVsZU5hbWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgICBuZ0hvc3QuYW1kTW9kdWxlTmFtZSkge1xuICAgICAgcmV0dXJuIG5nSG9zdC5hbWRNb2R1bGVOYW1lKHtmaWxlTmFtZTogaW1wb3J0ZWRGaWxlUGF0aH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gQU1EIG1vZHVsZSBuYW1lIGhhcyBiZWVuIHNldCBmb3IgdGhlIHNvdXJjZSBmaWxlIGJ5IHRoZSBgQGJhemVsL3R5cGVzY3JpcHRgIGNvbXBpbGVyXG4gICAgLy8gaG9zdCwgYW5kIHRoZSB0YXJnZXQgZmlsZSBpcyBub3QgcGFydCBvZiBhIGZsYXQgbW9kdWxlIG5vZGUgbW9kdWxlIHBhY2thZ2UsIHdlIHVzZSB0aGVcbiAgICAvLyBmb2xsb3dpbmcgcnVsZXMgKGluIG9yZGVyKTpcbiAgICAvLyAgICAxLiBJZiB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGBub2RlX21vZHVsZXMvYCwgd2UgdXNlIHRoZSBwYWNrYWdlIG1vZHVsZSBuYW1lLlxuICAgIC8vICAgIDIuIElmIG5vIGNvbnRhaW5pbmcgZmlsZSBpcyBzcGVjaWZpZWQsIG9yIHRoZSB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGEgZGlmZmVyZW50XG4gICAgLy8gICAgICAgY29tcGlsYXRpb24gdW5pdCwgd2UgdXNlIGEgQmF6ZWwgbWFuaWZlc3QgcGF0aC4gUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBwb3NzaWJsZVxuICAgIC8vICAgICAgIHNpbmNlIHdlIGRvbid0IGhhdmUgYSBjb250YWluaW5nIGZpbGUsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgY291bGQgYmUgbG9jYXRlZCBpbiB0aGVcbiAgICAvLyAgICAgICBvdXRwdXQgZGlyZWN0b3J5LCBvciBpbiBhbiBleHRlcm5hbCBCYXplbCByZXBvc2l0b3J5LlxuICAgIC8vICAgIDMuIElmIGJvdGggcnVsZXMgYWJvdmUgZGlkbid0IG1hdGNoLCB3ZSBjb21wdXRlIGEgcmVsYXRpdmUgcGF0aCBiZXR3ZWVuIHRoZSBzb3VyY2UgZmlsZXNcbiAgICAvLyAgICAgICBzaW5jZSB0aGV5IGFyZSBwYXJ0IG9mIHRoZSBzYW1lIGNvbXBpbGF0aW9uIHVuaXQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IHdhbnQgdG8gYWx3YXlzIHVzZSAoMikgYmVjYXVzZSBpdCBjb3VsZCBtZWFuIHRoYXQgY29tcGlsYXRpb24gb3V0cHV0c1xuICAgIC8vIGFyZSBhbHdheXMgbGVha2luZyBCYXplbC1zcGVjaWZpYyBwYXRocywgYW5kIHRoZSBvdXRwdXQgaXMgbm90IHNlbGYtY29udGFpbmVkLiBUaGlzIGNvdWxkXG4gICAgLy8gYnJlYWsgYGVzbTIwMTVgIG9yIGBlc201YCBvdXRwdXQgZm9yIEFuZ3VsYXIgcGFja2FnZSByZWxlYXNlIG91dHB1dFxuICAgIC8vIE9taXQgdGhlIGBub2RlX21vZHVsZXNgIHByZWZpeCBpZiB0aGUgbW9kdWxlIG5hbWUgb2YgYW4gTlBNIHBhY2thZ2UgaXMgcmVxdWVzdGVkLlxuICAgIGlmIChyZWxhdGl2ZVRhcmdldFBhdGguc3RhcnRzV2l0aChOT0RFX01PRFVMRVMpKSB7XG4gICAgICByZXR1cm4gcmVsYXRpdmVUYXJnZXRQYXRoLnN1YnN0cihOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjb250YWluaW5nRmlsZVBhdGggPT0gbnVsbCB8fCAhYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluY2x1ZGVzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgICBjb25zdCBjb250YWluaW5nRmlsZURpciA9XG4gICAgICAgIHBhdGguZGlybmFtZShyZWxhdGl2ZVRvUm9vdERpcnMoY29udGFpbmluZ0ZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpKTtcbiAgICBjb25zdCByZWxhdGl2ZUltcG9ydFBhdGggPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGNvbnRhaW5pbmdGaWxlRGlyLCByZWxhdGl2ZVRhcmdldFBhdGgpO1xuICAgIHJldHVybiByZWxhdGl2ZUltcG9ydFBhdGguc3RhcnRzV2l0aCgnLicpID8gcmVsYXRpdmVJbXBvcnRQYXRoIDogYC4vJHtyZWxhdGl2ZUltcG9ydFBhdGh9YDtcbiAgfVxufVxuIl19