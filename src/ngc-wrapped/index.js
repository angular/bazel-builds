/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
        define("@angular/bazel", ["require", "exports", "@angular/compiler-cli", "@bazel/typescript", "fs", "path", "tsickle/src/tsickle", "typescript"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ng = require("@angular/compiler-cli");
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
        if (errors && errors.length) {
            console.error(ng.formatDiagnostics(errors));
            return false;
        }
        const { options: tsOptions, bazelOpts, files, config } = parsedOptions;
        const angularCompilerOptions = config['angularCompilerOptions'] || {};
        // Allow Bazel users to control some of the bazel options.
        // Since TypeScript's "extends" mechanism applies only to "compilerOptions"
        // we have to repeat some of their logic to get the user's "angularCompilerOptions".
        if (config['extends']) {
            // Load the user's config file
            // Note: this doesn't handle recursive extends so only a user's top level
            // `angularCompilerOptions` will be considered. As this code is going to be
            // removed with Ivy, the added complication of handling recursive extends
            // is likely not needed.
            let userConfigFile = typescript_1.resolveNormalizedPath(path.dirname(project), config['extends']);
            if (!userConfigFile.endsWith('.json'))
                userConfigFile += '.json';
            const { config: userConfig, error } = ts.readConfigFile(userConfigFile, ts.sys.readFile);
            if (error) {
                console.error(ng.formatDiagnostics([error]));
                return false;
            }
            // All user angularCompilerOptions values that a user has control
            // over should be collected here
            if (userConfig.angularCompilerOptions) {
                angularCompilerOptions.diagnostics =
                    angularCompilerOptions.diagnostics || userConfig.angularCompilerOptions.diagnostics;
                angularCompilerOptions.trace =
                    angularCompilerOptions.trace || userConfig.angularCompilerOptions.trace;
                angularCompilerOptions.disableExpressionLowering =
                    angularCompilerOptions.disableExpressionLowering ||
                        userConfig.angularCompilerOptions.disableExpressionLowering;
                angularCompilerOptions.disableTypeScriptVersionCheck =
                    angularCompilerOptions.disableTypeScriptVersionCheck ||
                        userConfig.angularCompilerOptions.disableTypeScriptVersionCheck;
                angularCompilerOptions.i18nOutLocale =
                    angularCompilerOptions.i18nOutLocale || userConfig.angularCompilerOptions.i18nOutLocale;
                angularCompilerOptions.i18nOutFormat =
                    angularCompilerOptions.i18nOutFormat || userConfig.angularCompilerOptions.i18nOutFormat;
                angularCompilerOptions.i18nOutFile =
                    angularCompilerOptions.i18nOutFile || userConfig.angularCompilerOptions.i18nOutFile;
                angularCompilerOptions.i18nInFormat =
                    angularCompilerOptions.i18nInFormat || userConfig.angularCompilerOptions.i18nInFormat;
                angularCompilerOptions.i18nInLocale =
                    angularCompilerOptions.i18nInLocale || userConfig.angularCompilerOptions.i18nInLocale;
                angularCompilerOptions.i18nInFile =
                    angularCompilerOptions.i18nInFile || userConfig.angularCompilerOptions.i18nInFile;
                angularCompilerOptions.i18nInMissingTranslations =
                    angularCompilerOptions.i18nInMissingTranslations ||
                        userConfig.angularCompilerOptions.i18nInMissingTranslations;
                angularCompilerOptions.i18nUseExternalIds = angularCompilerOptions.i18nUseExternalIds ||
                    userConfig.angularCompilerOptions.i18nUseExternalIds;
                angularCompilerOptions.preserveWhitespaces = angularCompilerOptions.preserveWhitespaces ||
                    userConfig.angularCompilerOptions.preserveWhitespaces;
            }
        }
        const expectedOuts = config['angularCompilerOptions']['expectedOut'];
        const { basePath } = ng.calcProjectFileAndBasePath(project);
        const compilerOpts = ng.createNgCompilerOptions(basePath, config, tsOptions);
        const tsHost = ts.createCompilerHost(compilerOpts, true);
        const { diagnostics } = compile({
            allDepsCompiledWithBazel: ALL_DEPS_COMPILED_WITH_BAZEL,
            compilerOpts,
            tsHost,
            bazelOpts,
            files,
            inputs,
            expectedOuts
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
    function compile({ allDepsCompiledWithBazel = true, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics }) {
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
            const resolvedInputs = {};
            const inputKeys = Object.keys(inputs);
            for (let i = 0; i < inputKeys.length; i++) {
                const key = inputKeys[i];
                resolvedInputs[typescript_1.resolveNormalizedPath(key)] = inputs[key];
            }
            fileCache.updateCache(resolvedInputs);
        }
        else {
            fileLoader = new typescript_1.UncachedFileLoader();
        }
        if (!bazelOpts.es5Mode) {
            compilerOpts.annotateForClosureCompiler = true;
            compilerOpts.annotationsAs = 'static fields';
        }
        // Detect from compilerOpts whether the entrypoint is being invoked in Ivy mode.
        const isInIvyMode = compilerOpts.enableIvy === 'ngtsc' || compilerOpts.enableIvy === 'tsc';
        // Disable downleveling and Closure annotation if in Ivy mode.
        if (isInIvyMode) {
            // In pass-through mode for TypeScript, we want to turn off decorator transpilation entirely.
            // This causes ngc to be have exactly like tsc.
            if (compilerOpts.enableIvy === 'tsc') {
                compilerOpts.annotateForClosureCompiler = false;
            }
            compilerOpts.annotationsAs = 'decorators';
        }
        if (!compilerOpts.rootDirs) {
            throw new Error('rootDirs is not set!');
        }
        const bazelBin = compilerOpts.rootDirs.find(rootDir => BAZEL_BIN.test(rootDir));
        if (!bazelBin) {
            throw new Error(`Couldn't find bazel bin in the rootDirs: ${compilerOpts.rootDirs}`);
        }
        const writtenExpectedOuts = [...expectedOuts];
        const originalWriteFile = tsHost.writeFile.bind(tsHost);
        tsHost.writeFile =
            (fileName, content, writeByteOrderMark, onError, sourceFiles) => {
                const relative = relativeToRootDirs(fileName.replace(/\\/g, '/'), [compilerOpts.rootDir]);
                const expectedIdx = writtenExpectedOuts.findIndex(o => o === relative);
                if (expectedIdx >= 0) {
                    writtenExpectedOuts.splice(expectedIdx, 1);
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
        const bazelHost = new typescript_1.CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader, generatedFileModuleResolver);
        // Also need to disable decorator downleveling in the BazelHost in Ivy mode.
        if (isInIvyMode) {
            bazelHost.transformDecorators = false;
        }
        // Prevent tsickle adding any types at all if we don't want closure compiler annotations.
        bazelHost.transformTypesToClosure = compilerOpts.annotateForClosureCompiler;
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
            // Memoize this lookup to avoid expensive re-parses of the same file
            // When run as a worker, the actual ts.SourceFile is cached
            // but when we don't run as a worker, there is no cache.
            // For one example target in g3, we saw a cache hit rate of 7590/7695
            if (fileNameToModuleNameCache.has(importedFilePath)) {
                return fileNameToModuleNameCache.get(importedFilePath);
            }
            const result = doFileNameToModuleName(importedFilePath);
            fileNameToModuleNameCache.set(importedFilePath, result);
            return result;
        };
        function doFileNameToModuleName(importedFilePath) {
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
            if ((compilerOpts.module === ts.ModuleKind.UMD || compilerOpts.module === ts.ModuleKind.AMD) &&
                ngHost.amdModuleName) {
                return ngHost.amdModuleName({ fileName: importedFilePath });
            }
            const result = relativeToRootDirs(importedFilePath, compilerOpts.rootDirs).replace(EXT, '');
            if (result.startsWith(NODE_MODULES)) {
                return result.substr(NODE_MODULES.length);
            }
            return bazelOpts.workspaceName + '/' + result;
        }
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
        });
        if (!gatherDiagnostics) {
            gatherDiagnostics = (program) => gatherDiagnosticsForInputsOnly(compilerOpts, bazelOpts, program);
        }
        const { diagnostics, emitResult, program } = ng.performCompilation({
            rootNames: files,
            options: compilerOpts,
            host: ngHost, emitCallback,
            mergeEmitResultsCallback: tsickle.mergeEmitResults, gatherDiagnostics
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
        for (let i = 0; i < writtenExpectedOuts.length; i++) {
            originalWriteFile(writtenExpectedOuts[i], '', false);
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
    function gatherDiagnosticsForInputsOnly(options, bazelOpts, ngProgram) {
        const tsProgram = ngProgram.getTsProgram();
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCw0Q0FBNEM7SUFDNUMsa0RBQXNOO0lBQ3ROLHlCQUF5QjtJQUN6Qiw2QkFBNkI7SUFDN0IsK0NBQW1DO0lBQ25DLGlDQUFpQztJQUVqQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztJQUMvQyxNQUFNLGFBQWEsR0FBRywwREFBMEQsQ0FBQztJQUNqRiwyRUFBMkU7SUFDM0UsbUJBQW1CO0lBQ25CLE1BQU0sVUFBVSxHQUFHLCtCQUErQixDQUFDO0lBRW5ELE1BQU0sU0FBUyxHQUFHLGlDQUFpQyxDQUFDO0lBRXBELDRFQUE0RTtJQUM1RSxNQUFNLDRCQUE0QixHQUFHLEtBQUssQ0FBQztJQUUzQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7SUFFckMsU0FBZ0IsSUFBSSxDQUFDLElBQUk7UUFDdkIsSUFBSSx3QkFBVyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3JCLDBCQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDNUI7YUFBTTtZQUNMLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNsQztRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQVBELG9CQU9DO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBZ0Isa0JBQUssQ0FBQyxDQUFDO0lBRXRELFNBQWdCLFdBQVcsQ0FBQyxJQUFjLEVBQUUsTUFBaUM7UUFDM0UsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSTtZQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyx5REFBeUQ7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QUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUMzRDtRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ3ZCLGdFQUFnRTtZQUNoRSxzQkFBc0I7WUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7WUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7U0FDM0Q7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2hEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtCYXplbE9wdGlvbnMsIENhY2hlZEZpbGVMb2FkZXIsIENvbXBpbGVySG9zdCwgRmlsZUNhY2hlLCBGaWxlTG9hZGVyLCBVbmNhY2hlZEZpbGVMb2FkZXIsIGNvbnN0cnVjdE1hbmlmZXN0LCBkZWJ1ZywgcGFyc2VUc2NvbmZpZywgcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoLCBydW5Bc1dvcmtlciwgcnVuV29ya2VyTG9vcH0gZnJvbSAnQGJhemVsL3R5cGVzY3JpcHQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzaWNrbGUgZnJvbSAndHNpY2tsZSc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuY29uc3QgRVhUID0gLyhcXC50c3xcXC5kXFwudHN8XFwuanN8XFwuanN4fFxcLnRzeCkkLztcbmNvbnN0IE5HQ19HRU5fRklMRVMgPSAvXiguKj8pXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnl8bmdzdHlsZXxzaGltXFwubmdzdHlsZSkoLiopJC87XG4vLyBGSVhNRTogd2Ugc2hvdWxkIGJlIGFibGUgdG8gYWRkIHRoZSBhc3NldHMgdG8gdGhlIHRzY29uZmlnIHNvIEZpbGVMb2FkZXJcbi8vIGtub3dzIGFib3V0IHRoZW1cbmNvbnN0IE5HQ19BU1NFVFMgPSAvXFwuKGNzc3xodG1sfG5nc3VtbWFyeVxcLmpzb24pJC87XG5cbmNvbnN0IEJBWkVMX0JJTiA9IC9cXGIoYmxhemV8YmF6ZWwpLW91dFxcYi4qP1xcYmJpblxcYi87XG5cbi8vIE5vdGU6IFdlIGNvbXBpbGUgdGhlIGNvbnRlbnQgb2Ygbm9kZV9tb2R1bGVzIHdpdGggcGxhaW4gbmdjIGNvbW1hbmQgbGluZS5cbmNvbnN0IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwgPSBmYWxzZTtcblxuY29uc3QgTk9ERV9NT0RVTEVTID0gJ25vZGVfbW9kdWxlcy8nO1xuXG5leHBvcnQgZnVuY3Rpb24gbWFpbihhcmdzKSB7XG4gIGlmIChydW5Bc1dvcmtlcihhcmdzKSkge1xuICAgIHJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBydW5PbmVCdWlsZChhcmdzKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgRmlsZUNhY2hlPHRzLlNvdXJjZUZpbGU+KGRlYnVnKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk9uZUJ1aWxkKGFyZ3M6IHN0cmluZ1tdLCBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30pOiBib29sZWFuIHtcbiAgaWYgKGFyZ3NbMF0gPT09ICctcCcpIGFyZ3Muc2hpZnQoKTtcbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcocHJvamVjdCk7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHtvcHRpb25zOiB0c09wdGlvbnMsIGJhemVsT3B0cywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCBhbmd1bGFyQ29tcGlsZXJPcHRpb25zOiB7W2s6IHN0cmluZ106IHVua25vd259ID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ10gfHwge307XG5cbiAgLy8gQWxsb3cgQmF6ZWwgdXNlcnMgdG8gY29udHJvbCBzb21lIG9mIHRoZSBiYXplbCBvcHRpb25zLlxuICAvLyBTaW5jZSBUeXBlU2NyaXB0J3MgXCJleHRlbmRzXCIgbWVjaGFuaXNtIGFwcGxpZXMgb25seSB0byBcImNvbXBpbGVyT3B0aW9uc1wiXG4gIC8vIHdlIGhhdmUgdG8gcmVwZWF0IHNvbWUgb2YgdGhlaXIgbG9naWMgdG8gZ2V0IHRoZSB1c2VyJ3MgXCJhbmd1bGFyQ29tcGlsZXJPcHRpb25zXCIuXG4gIGlmIChjb25maWdbJ2V4dGVuZHMnXSkge1xuICAgIC8vIExvYWQgdGhlIHVzZXIncyBjb25maWcgZmlsZVxuICAgIC8vIE5vdGU6IHRoaXMgZG9lc24ndCBoYW5kbGUgcmVjdXJzaXZlIGV4dGVuZHMgc28gb25seSBhIHVzZXIncyB0b3AgbGV2ZWxcbiAgICAvLyBgYW5ndWxhckNvbXBpbGVyT3B0aW9uc2Agd2lsbCBiZSBjb25zaWRlcmVkLiBBcyB0aGlzIGNvZGUgaXMgZ29pbmcgdG8gYmVcbiAgICAvLyByZW1vdmVkIHdpdGggSXZ5LCB0aGUgYWRkZWQgY29tcGxpY2F0aW9uIG9mIGhhbmRsaW5nIHJlY3Vyc2l2ZSBleHRlbmRzXG4gICAgLy8gaXMgbGlrZWx5IG5vdCBuZWVkZWQuXG4gICAgbGV0IHVzZXJDb25maWdGaWxlID0gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKHBhdGguZGlybmFtZShwcm9qZWN0KSwgY29uZmlnWydleHRlbmRzJ10pO1xuICAgIGlmICghdXNlckNvbmZpZ0ZpbGUuZW5kc1dpdGgoJy5qc29uJykpIHVzZXJDb25maWdGaWxlICs9ICcuanNvbic7XG4gICAgY29uc3Qge2NvbmZpZzogdXNlckNvbmZpZywgZXJyb3J9ID0gdHMucmVhZENvbmZpZ0ZpbGUodXNlckNvbmZpZ0ZpbGUsIHRzLnN5cy5yZWFkRmlsZSk7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKFtlcnJvcl0pKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBBbGwgdXNlciBhbmd1bGFyQ29tcGlsZXJPcHRpb25zIHZhbHVlcyB0aGF0IGEgdXNlciBoYXMgY29udHJvbFxuICAgIC8vIG92ZXIgc2hvdWxkIGJlIGNvbGxlY3RlZCBoZXJlXG4gICAgaWYgKHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucykge1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5kaWFnbm9zdGljcyA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5kaWFnbm9zdGljcyB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlhZ25vc3RpY3M7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLnRyYWNlID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLnRyYWNlIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy50cmFjZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5kaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcgfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZztcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2sgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2sgfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2s7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dExvY2FsZSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0TG9jYWxlIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0TG9jYWxlO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0Rm9ybWF0ID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRGb3JtYXQgfHwgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRGb3JtYXQ7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRGaWxlID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRGaWxlIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0RmlsZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Gb3JtYXQgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRm9ybWF0IHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Gb3JtYXQ7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5JbkxvY2FsZSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Mb2NhbGUgfHwgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5JbkxvY2FsZTtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRmlsZSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5GaWxlIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5GaWxlO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucyB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHMgPSBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5Vc2VFeHRlcm5hbElkcyB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHM7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcyA9IGFuZ3VsYXJDb21waWxlck9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcyB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2VzO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0cyA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddWydleHBlY3RlZE91dCddO1xuXG4gIGNvbnN0IHtiYXNlUGF0aH0gPSBuZy5jYWxjUHJvamVjdEZpbGVBbmRCYXNlUGF0aChwcm9qZWN0KTtcbiAgY29uc3QgY29tcGlsZXJPcHRzID0gbmcuY3JlYXRlTmdDb21waWxlck9wdGlvbnMoYmFzZVBhdGgsIGNvbmZpZywgdHNPcHRpb25zKTtcbiAgY29uc3QgdHNIb3N0ID0gdHMuY3JlYXRlQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0cywgdHJ1ZSk7XG4gIGNvbnN0IHtkaWFnbm9zdGljc30gPSBjb21waWxlKHtcbiAgICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw6IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICAgIGV4cGVjdGVkT3V0c1xuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVQYXRoOiBzdHJpbmcsIHJvb3REaXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmICghZmlsZVBhdGgpIHJldHVybiBmaWxlUGF0aDtcbiAgLy8gTkI6IHRoZSByb290RGlycyBzaG91bGQgaGF2ZSBiZWVuIHNvcnRlZCBsb25nZXN0LWZpcnN0XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcm9vdERpcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBkaXIgPSByb290RGlyc1tpXTtcbiAgICBjb25zdCByZWwgPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGRpciwgZmlsZVBhdGgpO1xuICAgIGlmIChyZWwuaW5kZXhPZignLicpICE9IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7YWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsID0gdHJ1ZSwgY29tcGlsZXJPcHRzLCB0c0hvc3QsIGJhemVsT3B0cywgZmlsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRzLCBleHBlY3RlZE91dHMsIGdhdGhlckRpYWdub3N0aWNzfToge1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuLFxuICBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gIGZpbGVzOiBzdHJpbmdbXSxcbiAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXSwgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogbmcuUHJvZ3JhbSkgPT4gbmcuRGlhZ25vc3RpY3Ncbn0pOiB7ZGlhZ25vc3RpY3M6IG5nLkRpYWdub3N0aWNzLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfSB7XG4gIGxldCBmaWxlTG9hZGVyOiBGaWxlTG9hZGVyO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgQ2FjaGVkRmlsZUxvYWRlcihmaWxlQ2FjaGUpO1xuICAgIC8vIFJlc29sdmUgdGhlIGlucHV0cyB0byBhYnNvbHV0ZSBwYXRocyB0byBtYXRjaCBUeXBlU2NyaXB0IGludGVybmFsc1xuICAgIGNvbnN0IHJlc29sdmVkSW5wdXRzOiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBjb25zdCBpbnB1dEtleXMgPSBPYmplY3Qua2V5cyhpbnB1dHMpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBrZXkgPSBpbnB1dEtleXNbaV07XG4gICAgICByZXNvbHZlZElucHV0c1tyZXNvbHZlTm9ybWFsaXplZFBhdGgoa2V5KV0gPSBpbnB1dHNba2V5XTtcbiAgICB9XG4gICAgZmlsZUNhY2hlLnVwZGF0ZUNhY2hlKHJlc29sdmVkSW5wdXRzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IFVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgaWYgKCFiYXplbE9wdHMuZXM1TW9kZSkge1xuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IHRydWU7XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRpb25zQXMgPSAnc3RhdGljIGZpZWxkcyc7XG4gIH1cblxuICAvLyBEZXRlY3QgZnJvbSBjb21waWxlck9wdHMgd2hldGhlciB0aGUgZW50cnlwb2ludCBpcyBiZWluZyBpbnZva2VkIGluIEl2eSBtb2RlLlxuICBjb25zdCBpc0luSXZ5TW9kZSA9IGNvbXBpbGVyT3B0cy5lbmFibGVJdnkgPT09ICduZ3RzYycgfHwgY29tcGlsZXJPcHRzLmVuYWJsZUl2eSA9PT0gJ3RzYyc7XG5cbiAgLy8gRGlzYWJsZSBkb3dubGV2ZWxpbmcgYW5kIENsb3N1cmUgYW5ub3RhdGlvbiBpZiBpbiBJdnkgbW9kZS5cbiAgaWYgKGlzSW5JdnlNb2RlKSB7XG4gICAgLy8gSW4gcGFzcy10aHJvdWdoIG1vZGUgZm9yIFR5cGVTY3JpcHQsIHdlIHdhbnQgdG8gdHVybiBvZmYgZGVjb3JhdG9yIHRyYW5zcGlsYXRpb24gZW50aXJlbHkuXG4gICAgLy8gVGhpcyBjYXVzZXMgbmdjIHRvIGJlIGhhdmUgZXhhY3RseSBsaWtlIHRzYy5cbiAgICBpZiAoY29tcGlsZXJPcHRzLmVuYWJsZUl2eSA9PT0gJ3RzYycpIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IGZhbHNlO1xuICAgIH1cbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGlvbnNBcyA9ICdkZWNvcmF0b3JzJztcbiAgfVxuXG4gIGlmICghY29tcGlsZXJPcHRzLnJvb3REaXJzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdyb290RGlycyBpcyBub3Qgc2V0IScpO1xuICB9XG4gIGNvbnN0IGJhemVsQmluID0gY29tcGlsZXJPcHRzLnJvb3REaXJzLmZpbmQocm9vdERpciA9PiBCQVpFTF9CSU4udGVzdChyb290RGlyKSk7XG4gIGlmICghYmF6ZWxCaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgYmF6ZWwgYmluIGluIHRoZSByb290RGlyczogJHtjb21waWxlck9wdHMucm9vdERpcnN9YCk7XG4gIH1cblxuICBjb25zdCB3cml0dGVuRXhwZWN0ZWRPdXRzID0gWy4uLmV4cGVjdGVkT3V0c107XG5cbiAgY29uc3Qgb3JpZ2luYWxXcml0ZUZpbGUgPSB0c0hvc3Qud3JpdGVGaWxlLmJpbmQodHNIb3N0KTtcbiAgdHNIb3N0LndyaXRlRmlsZSA9XG4gICAgICAoZmlsZU5hbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCB3cml0ZUJ5dGVPcmRlck1hcms6IGJvb2xlYW4sXG4gICAgICAgb25FcnJvcj86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQsIHNvdXJjZUZpbGVzPzogdHMuU291cmNlRmlsZVtdKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlID0gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVOYW1lLnJlcGxhY2UoL1xcXFwvZywgJy8nKSwgW2NvbXBpbGVyT3B0cy5yb290RGlyXSk7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkSWR4ID0gd3JpdHRlbkV4cGVjdGVkT3V0cy5maW5kSW5kZXgobyA9PiBvID09PSByZWxhdGl2ZSk7XG4gICAgICAgIGlmIChleHBlY3RlZElkeCA+PSAwKSB7XG4gICAgICAgICAgd3JpdHRlbkV4cGVjdGVkT3V0cy5zcGxpY2UoZXhwZWN0ZWRJZHgsIDEpO1xuICAgICAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3QgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCA9IE9iamVjdC5jcmVhdGUodHNIb3N0KTtcbiAgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBtYXRjaCA9IE5HQ19HRU5fRklMRVMuZXhlYyhmaWxlTmFtZSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbLCBmaWxlLCBzdWZmaXgsIGV4dF0gPSBtYXRjaDtcbiAgICAgIC8vIFBlcmZvcm1hbmNlOiBza2lwIGxvb2tpbmcgZm9yIGZpbGVzIG90aGVyIHRoYW4gLmQudHMgb3IgLnRzXG4gICAgICBpZiAoZXh0ICE9PSAnLnRzJyAmJiBleHQgIT09ICcuZC50cycpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmIChzdWZmaXguaW5kZXhPZignbmdzdHlsZScpID49IDApIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmNzcyBvbiBkaXNrXG4gICAgICAgIGZpbGVOYW1lID0gZmlsZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5kLnRzIG9yIGZvby50cyBvbiBkaXNrXG4gICAgICAgIGZpbGVOYW1lID0gZmlsZSArIChleHQgfHwgJycpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcihcbiAgICAgIG1vZHVsZU5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU6IHN0cmluZyxcbiAgICAgIGNvbXBpbGVyT3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zKTogdHMuUmVzb2x2ZWRNb2R1bGVXaXRoRmFpbGVkTG9va3VwTG9jYXRpb25zIHtcbiAgICByZXR1cm4gdHMucmVzb2x2ZU1vZHVsZU5hbWUoXG4gICAgICAgIG1vZHVsZU5hbWUsIGNvbnRhaW5pbmdGaWxlLCBjb21waWxlck9wdGlvbnMsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QpO1xuICB9XG5cbiAgY29uc3QgYmF6ZWxIb3N0ID0gbmV3IENvbXBpbGVySG9zdChcbiAgICAgIGZpbGVzLCBjb21waWxlck9wdHMsIGJhemVsT3B0cywgdHNIb3N0LCBmaWxlTG9hZGVyLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIpO1xuXG4gIC8vIEFsc28gbmVlZCB0byBkaXNhYmxlIGRlY29yYXRvciBkb3dubGV2ZWxpbmcgaW4gdGhlIEJhemVsSG9zdCBpbiBJdnkgbW9kZS5cbiAgaWYgKGlzSW5JdnlNb2RlKSB7XG4gICAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIFByZXZlbnQgdHNpY2tsZSBhZGRpbmcgYW55IHR5cGVzIGF0IGFsbCBpZiB3ZSBkb24ndCB3YW50IGNsb3N1cmUgY29tcGlsZXIgYW5ub3RhdGlvbnMuXG4gIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcjtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdEZpbGVFeGlzdCA9IGJhemVsSG9zdC5maWxlRXhpc3RzO1xuICBiYXplbEhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKE5HQ19BU1NFVFMudGVzdChmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0LmNhbGwoYmF6ZWxIb3N0LCBmaWxlTmFtZSk7XG4gIH07XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlID0gYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZmxhdE1vZHVsZU91dFBhdGggPVxuICAgICAgICBwYXRoLnBvc2l4LmpvaW4oYmF6ZWxPcHRzLnBhY2thZ2UsIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnKTtcblxuICAgIC8vIFRoZSBidW5kbGUgaW5kZXggZmlsZSBpcyBzeW50aGVzaXplZCBpbiBidW5kbGVfaW5kZXhfaG9zdCBzbyBpdCdzIG5vdCBpbiB0aGVcbiAgICAvLyBjb21waWxhdGlvblRhcmdldFNyYy5cbiAgICAvLyBIb3dldmVyIHdlIHN0aWxsIHdhbnQgdG8gZ2l2ZSBpdCBhbiBBTUQgbW9kdWxlIG5hbWUgZm9yIGRldm1vZGUuXG4gICAgLy8gV2UgY2FuJ3QgZWFzaWx5IHRlbGwgd2hpY2ggZmlsZSBpcyB0aGUgc3ludGhldGljIG9uZSwgc28gd2UgYnVpbGQgdXAgdGhlIHBhdGggd2UgZXhwZWN0XG4gICAgLy8gaXQgdG8gaGF2ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsIGZsYXRNb2R1bGVPdXRQYXRoKSkgcmV0dXJuIHRydWU7XG5cbiAgICAvLyBBbHNvIGhhbmRsZSB0aGUgY2FzZSB0aGUgdGFyZ2V0IGlzIGluIGFuIGV4dGVybmFsIHJlcG9zaXRvcnkuXG4gICAgLy8gUHVsbCB0aGUgd29ya3NwYWNlIG5hbWUgZnJvbSB0aGUgdGFyZ2V0IHdoaWNoIGlzIGZvcm1hdHRlZCBhcyBgQHdrc3AvL3BhY2thZ2U6dGFyZ2V0YFxuICAgIC8vIGlmIGl0IHRoZSB0YXJnZXQgaXMgZnJvbSBhbiBleHRlcm5hbCB3b3Jrc3BhY2UuIElmIHRoZSB0YXJnZXQgaXMgZnJvbSB0aGUgbG9jYWxcbiAgICAvLyB3b3Jrc3BhY2UgdGhlbiBpdCB3aWxsIGJlIGZvcm1hdHRlZCBhcyBgLy9wYWNrYWdlOnRhcmdldGAuXG4gICAgY29uc3QgdGFyZ2V0V29ya3NwYWNlID0gYmF6ZWxPcHRzLnRhcmdldC5zcGxpdCgnLycpWzBdLnJlcGxhY2UoL15ALywgJycpO1xuXG4gICAgaWYgKHRhcmdldFdvcmtzcGFjZSAmJlxuICAgICAgICBmaWxlTmFtZSA9PT1cbiAgICAgICAgICAgIHBhdGgucG9zaXguam9pbihjb21waWxlck9wdHMuYmFzZVVybCwgJ2V4dGVybmFsJywgdGFyZ2V0V29ya3NwYWNlLCBmbGF0TW9kdWxlT3V0UGF0aCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSkgfHwgTkdDX0dFTl9GSUxFUy50ZXN0KGZpbGVOYW1lKTtcbiAgfTtcblxuICBjb25zdCBuZ0hvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnM6IGNvbXBpbGVyT3B0cywgdHNIb3N0OiBiYXplbEhvc3R9KTtcbiAgY29uc3QgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIG5nSG9zdC5maWxlTmFtZVRvTW9kdWxlTmFtZSA9IChpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgLy8gTWVtb2l6ZSB0aGlzIGxvb2t1cCB0byBhdm9pZCBleHBlbnNpdmUgcmUtcGFyc2VzIG9mIHRoZSBzYW1lIGZpbGVcbiAgICAvLyBXaGVuIHJ1biBhcyBhIHdvcmtlciwgdGhlIGFjdHVhbCB0cy5Tb3VyY2VGaWxlIGlzIGNhY2hlZFxuICAgIC8vIGJ1dCB3aGVuIHdlIGRvbid0IHJ1biBhcyBhIHdvcmtlciwgdGhlcmUgaXMgbm8gY2FjaGUuXG4gICAgLy8gRm9yIG9uZSBleGFtcGxlIHRhcmdldCBpbiBnMywgd2Ugc2F3IGEgY2FjaGUgaGl0IHJhdGUgb2YgNzU5MC83Njk1XG4gICAgaWYgKGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuaGFzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5nZXQoaW1wb3J0ZWRGaWxlUGF0aCk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCk7XG4gICAgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5zZXQoaW1wb3J0ZWRGaWxlUGF0aCwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IG5nSG9zdC5nZXRTb3VyY2VGaWxlKGltcG9ydGVkRmlsZVBhdGgsIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QpO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgJiYgc291cmNlRmlsZS5tb2R1bGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlLm1vZHVsZU5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIHBhcnNlIGVycm9yLiBJZ25vcmUgdGhpcyBjYXNlIGFuZCBjb250aW51ZSBvbnRvIHRoZVxuICAgICAgLy8gb3RoZXIgbWV0aG9kcyBvZiByZXNvbHZpbmcgdGhlIG1vZHVsZSBiZWxvdy5cbiAgICB9XG4gICAgaWYgKChjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLlVNRCB8fCBjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLkFNRCkgJiZcbiAgICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWUpIHtcbiAgICAgIHJldHVybiBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7IGZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRoIH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgaWYgKHJlc3VsdC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZXN1bHQuc3Vic3RyKE5PREVfTU9EVUxFUy5sZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUgKyAnLycgKyByZXN1bHQ7XG4gIH1cblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IG5nLlRzRW1pdENhbGxiYWNrID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QsIGJhemVsSG9zdCwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyLFxuICAgICAgICAgIH0pO1xuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0pO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oe1xuICAgIHJvb3ROYW1lczogZmlsZXMsXG4gICAgb3B0aW9uczogY29tcGlsZXJPcHRzLFxuICAgIGhvc3Q6IG5nSG9zdCwgZW1pdENhbGxiYWNrLFxuICAgIG1lcmdlRW1pdFJlc3VsdHNDYWxsYmFjazogdHNpY2tsZS5tZXJnZUVtaXRSZXN1bHRzLCBnYXRoZXJEaWFnbm9zdGljc1xuICB9KTtcbiAgY29uc3QgdHNpY2tsZUVtaXRSZXN1bHQgPSBlbWl0UmVzdWx0IGFzIHRzaWNrbGUuRW1pdFJlc3VsdDtcbiAgbGV0IGV4dGVybnMgPSAnLyoqIEBleHRlcm5zICovXFxuJztcbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVHZW5lcmF0ZUV4dGVybnMpIHtcbiAgICAgIGV4dGVybnMgKz0gdHNpY2tsZS5nZXRHZW5lcmF0ZWRFeHRlcm5zKHRzaWNrbGVFbWl0UmVzdWx0LmV4dGVybnMpO1xuICAgIH1cbiAgICBpZiAoYmF6ZWxPcHRzLm1hbmlmZXN0KSB7XG4gICAgICBjb25zdCBtYW5pZmVzdCA9IGNvbnN0cnVjdE1hbmlmZXN0KHRzaWNrbGVFbWl0UmVzdWx0Lm1vZHVsZXNNYW5pZmVzdCwgYmF6ZWxIb3N0KTtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLm1hbmlmZXN0LCBtYW5pZmVzdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgY29tcGlsYXRpb24gZmFpbHMgdW5leHBlY3RlZGx5LCBwZXJmb3JtQ29tcGlsYXRpb24gcmV0dXJucyBubyBwcm9ncmFtLlxuICAvLyBNYWtlIHN1cmUgbm90IHRvIGNyYXNoIGJ1dCByZXBvcnQgdGhlIGRpYWdub3N0aWNzLlxuICBpZiAoIXByb2dyYW0pIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xuXG4gIGlmICghYmF6ZWxPcHRzLm5vZGVNb2R1bGVzUHJlZml4KSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gbm9kZSBtb2R1bGVzLCB0aGVuIG1ldGFkYXRhLmpzb24gc2hvdWxkIGJlIGVtaXR0ZWQgc2luY2VcbiAgICAvLyB0aGVyZSBpcyBubyBvdGhlciB3YXkgdG8gb2J0YWluIHRoZSBpbmZvcm1hdGlvblxuICAgIGdlbmVyYXRlTWV0YWRhdGFKc29uKHByb2dyYW0uZ2V0VHNQcm9ncmFtKCksIGZpbGVzLCBjb21waWxlck9wdHMucm9vdERpcnMsIGJhemVsQmluLCB0c0hvc3QpO1xuICB9XG5cbiAgaWYgKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgpIHtcbiAgICAvLyBOb3RlOiB3aGVuIHRzaWNrbGVFeHRlcm5zUGF0aCBpcyBwcm92aWRlZCwgd2UgYWx3YXlzIHdyaXRlIGEgZmlsZSBhcyBhXG4gICAgLy8gbWFya2VyIHRoYXQgY29tcGlsYXRpb24gc3VjY2VlZGVkLCBldmVuIGlmIGl0J3MgZW1wdHkgKGp1c3QgY29udGFpbmluZyBhblxuICAgIC8vIEBleHRlcm5zKS5cbiAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgsIGV4dGVybnMpO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB3cml0dGVuRXhwZWN0ZWRPdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgb3JpZ2luYWxXcml0ZUZpbGUod3JpdHRlbkV4cGVjdGVkT3V0c1tpXSwgJycsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIG1ldGFkYXRhLmpzb24gZm9yIHRoZSBzcGVjaWZpZWQgYGZpbGVzYC4gQnkgZGVmYXVsdCwgbWV0YWRhdGEuanNvblxuICogaXMgb25seSBnZW5lcmF0ZWQgYnkgdGhlIGNvbXBpbGVyIGlmIC0tZmxhdE1vZHVsZU91dEZpbGUgaXMgc3BlY2lmaWVkLiBCdXRcbiAqIGlmIGNvbXBpbGVkIHVuZGVyIGJsYXplLCB3ZSB3YW50IHRoZSBtZXRhZGF0YSB0byBiZSBnZW5lcmF0ZWQgZm9yIGVhY2hcbiAqIEFuZ3VsYXIgY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZU1ldGFkYXRhSnNvbihcbiAgICBwcm9ncmFtOiB0cy5Qcm9ncmFtLCBmaWxlczogc3RyaW5nW10sIHJvb3REaXJzOiBzdHJpbmdbXSwgYmF6ZWxCaW46IHN0cmluZyxcbiAgICB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCkge1xuICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgbmcuTWV0YWRhdGFDb2xsZWN0b3IoKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpXTtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgIGlmIChzb3VyY2VGaWxlKSB7XG4gICAgICBjb25zdCBtZXRhZGF0YSA9IGNvbGxlY3Rvci5nZXRNZXRhZGF0YShzb3VyY2VGaWxlKTtcbiAgICAgIGlmIChtZXRhZGF0YSkge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9IHJlbGF0aXZlVG9Sb290RGlycyhmaWxlLCByb290RGlycyk7XG4gICAgICAgIGNvbnN0IHNob3J0UGF0aCA9IHJlbGF0aXZlLnJlcGxhY2UoRVhULCAnLm1ldGFkYXRhLmpzb24nKTtcbiAgICAgICAgY29uc3Qgb3V0RmlsZSA9IHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgc2hvcnRQYXRoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KG1ldGFkYXRhKTtcbiAgICAgICAgdHNIb3N0LndyaXRlRmlsZShvdXRGaWxlLCBkYXRhLCBmYWxzZSwgdW5kZWZpbmVkLCBbXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsIHNmOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhTkdDX0dFTl9GSUxFUy50ZXN0KHNmLmZpbGVOYW1lKSAmJlxuICAgICAgKGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmRleE9mKHNmLmZpbGVOYW1lKSAhPT0gLTEpO1xufVxuXG5mdW5jdGlvbiBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoXG4gICAgb3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICBuZ1Byb2dyYW06IG5nLlByb2dyYW0pOiAobmcuRGlhZ25vc3RpYyB8IHRzLkRpYWdub3N0aWMpW10ge1xuICBjb25zdCB0c1Byb2dyYW0gPSBuZ1Byb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG4gIGNvbnN0IGRpYWdub3N0aWNzOiAobmcuRGlhZ25vc3RpYyB8IHRzLkRpYWdub3N0aWMpW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoZiA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgfVxuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIC8vIG9ubHkgZ2F0aGVyIHRoZSBhbmd1bGFyIGRpYWdub3N0aWNzIGlmIHdlIGhhdmUgbm8gZGlhZ25vc3RpY3NcbiAgICAvLyBpbiBhbnkgb3RoZXIgZmlsZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIHByb2Nlc3MuZXhpdENvZGUgPSBtYWluKHByb2Nlc3MuYXJndi5zbGljZSgyKSk7XG59XG4iXX0=