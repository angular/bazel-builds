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
                angularCompilerOptions['diagnostics'] =
                    angularCompilerOptions['diagnostics'] || userConfig.angularCompilerOptions.diagnostics;
                angularCompilerOptions['trace'] =
                    angularCompilerOptions['trace'] || userConfig.angularCompilerOptions.trace;
                angularCompilerOptions['disableExpressionLowering'] =
                    angularCompilerOptions['disableExpressionLowering'] ||
                        userConfig.angularCompilerOptions.disableExpressionLowering;
                angularCompilerOptions['disableTypeScriptVersionCheck'] =
                    angularCompilerOptions['disableTypeScriptVersionCheck'] ||
                        userConfig.angularCompilerOptions.disableTypeScriptVersionCheck;
                angularCompilerOptions['i18nOutLocale'] = angularCompilerOptions['i18nOutLocale'] ||
                    userConfig.angularCompilerOptions.i18nOutLocale;
                angularCompilerOptions['i18nOutFormat'] = angularCompilerOptions['i18nOutFormat'] ||
                    userConfig.angularCompilerOptions.i18nOutFormat;
                angularCompilerOptions['i18nOutFile'] =
                    angularCompilerOptions['i18nOutFile'] || userConfig.angularCompilerOptions.i18nOutFile;
                angularCompilerOptions['i18nInFormat'] =
                    angularCompilerOptions['i18nInFormat'] || userConfig.angularCompilerOptions.i18nInFormat;
                angularCompilerOptions['i18nInLocale'] =
                    angularCompilerOptions['i18nInLocale'] || userConfig.angularCompilerOptions.i18nInLocale;
                angularCompilerOptions['i18nInFile'] =
                    angularCompilerOptions['i18nInFile'] || userConfig.angularCompilerOptions.i18nInFile;
                angularCompilerOptions['i18nInMissingTranslations'] =
                    angularCompilerOptions['i18nInMissingTranslations'] ||
                        userConfig.angularCompilerOptions.i18nInMissingTranslations;
                angularCompilerOptions['i18nUseExternalIds'] = angularCompilerOptions['i18nUseExternalIds'] ||
                    userConfig.angularCompilerOptions.i18nUseExternalIds;
                angularCompilerOptions['preserveWhitespaces'] =
                    angularCompilerOptions['preserveWhitespaces'] ||
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCw0Q0FBNEM7SUFDNUMsa0RBQXNOO0lBQ3ROLHlCQUF5QjtJQUN6Qiw2QkFBNkI7SUFDN0IsK0NBQW1DO0lBQ25DLGlDQUFpQztJQUVqQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztJQUMvQyxNQUFNLGFBQWEsR0FBRywwREFBMEQsQ0FBQztJQUNqRiwyRUFBMkU7SUFDM0UsbUJBQW1CO0lBQ25CLE1BQU0sVUFBVSxHQUFHLCtCQUErQixDQUFDO0lBRW5ELE1BQU0sU0FBUyxHQUFHLGlDQUFpQyxDQUFDO0lBRXBELDRFQUE0RTtJQUM1RSxNQUFNLDRCQUE0QixHQUFHLEtBQUssQ0FBQztJQUUzQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7SUFFckMsU0FBZ0IsSUFBSSxDQUFDLElBQUk7UUFDdkIsSUFBSSx3QkFBVyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3JCLDBCQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDNUI7YUFBTTtZQUNMLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNsQztRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQVBELG9CQU9DO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBZ0Isa0JBQUssQ0FBQyxDQUFDO0lBRXRELFNBQWdCLFdBQVcsQ0FBQyxJQUFjLEVBQUUsTUFBaUM7UUFDM0UsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSTtZQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyx5REFBeUQ7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QVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDNUMsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLHlEQUF5RDtZQUN6RCwrQkFBK0I7WUFDL0IsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUMzRDtRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ3ZCLGdFQUFnRTtZQUNoRSxzQkFBc0I7WUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7WUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7U0FDM0Q7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2hEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtCYXplbE9wdGlvbnMsIENhY2hlZEZpbGVMb2FkZXIsIENvbXBpbGVySG9zdCwgRmlsZUNhY2hlLCBGaWxlTG9hZGVyLCBVbmNhY2hlZEZpbGVMb2FkZXIsIGNvbnN0cnVjdE1hbmlmZXN0LCBkZWJ1ZywgcGFyc2VUc2NvbmZpZywgcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoLCBydW5Bc1dvcmtlciwgcnVuV29ya2VyTG9vcH0gZnJvbSAnQGJhemVsL3R5cGVzY3JpcHQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzaWNrbGUgZnJvbSAndHNpY2tsZSc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuY29uc3QgRVhUID0gLyhcXC50c3xcXC5kXFwudHN8XFwuanN8XFwuanN4fFxcLnRzeCkkLztcbmNvbnN0IE5HQ19HRU5fRklMRVMgPSAvXiguKj8pXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnl8bmdzdHlsZXxzaGltXFwubmdzdHlsZSkoLiopJC87XG4vLyBGSVhNRTogd2Ugc2hvdWxkIGJlIGFibGUgdG8gYWRkIHRoZSBhc3NldHMgdG8gdGhlIHRzY29uZmlnIHNvIEZpbGVMb2FkZXJcbi8vIGtub3dzIGFib3V0IHRoZW1cbmNvbnN0IE5HQ19BU1NFVFMgPSAvXFwuKGNzc3xodG1sfG5nc3VtbWFyeVxcLmpzb24pJC87XG5cbmNvbnN0IEJBWkVMX0JJTiA9IC9cXGIoYmxhemV8YmF6ZWwpLW91dFxcYi4qP1xcYmJpblxcYi87XG5cbi8vIE5vdGU6IFdlIGNvbXBpbGUgdGhlIGNvbnRlbnQgb2Ygbm9kZV9tb2R1bGVzIHdpdGggcGxhaW4gbmdjIGNvbW1hbmQgbGluZS5cbmNvbnN0IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwgPSBmYWxzZTtcblxuY29uc3QgTk9ERV9NT0RVTEVTID0gJ25vZGVfbW9kdWxlcy8nO1xuXG5leHBvcnQgZnVuY3Rpb24gbWFpbihhcmdzKSB7XG4gIGlmIChydW5Bc1dvcmtlcihhcmdzKSkge1xuICAgIHJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBydW5PbmVCdWlsZChhcmdzKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgRmlsZUNhY2hlPHRzLlNvdXJjZUZpbGU+KGRlYnVnKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk9uZUJ1aWxkKGFyZ3M6IHN0cmluZ1tdLCBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30pOiBib29sZWFuIHtcbiAgaWYgKGFyZ3NbMF0gPT09ICctcCcpIGFyZ3Muc2hpZnQoKTtcbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcocHJvamVjdCk7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHtvcHRpb25zOiB0c09wdGlvbnMsIGJhemVsT3B0cywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCBhbmd1bGFyQ29tcGlsZXJPcHRpb25zOiB7W2s6IHN0cmluZ106IHVua25vd259ID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ10gfHwge307XG5cbiAgLy8gQWxsb3cgQmF6ZWwgdXNlcnMgdG8gY29udHJvbCBzb21lIG9mIHRoZSBiYXplbCBvcHRpb25zLlxuICAvLyBTaW5jZSBUeXBlU2NyaXB0J3MgXCJleHRlbmRzXCIgbWVjaGFuaXNtIGFwcGxpZXMgb25seSB0byBcImNvbXBpbGVyT3B0aW9uc1wiXG4gIC8vIHdlIGhhdmUgdG8gcmVwZWF0IHNvbWUgb2YgdGhlaXIgbG9naWMgdG8gZ2V0IHRoZSB1c2VyJ3MgXCJhbmd1bGFyQ29tcGlsZXJPcHRpb25zXCIuXG4gIGlmIChjb25maWdbJ2V4dGVuZHMnXSkge1xuICAgIC8vIExvYWQgdGhlIHVzZXIncyBjb25maWcgZmlsZVxuICAgIC8vIE5vdGU6IHRoaXMgZG9lc24ndCBoYW5kbGUgcmVjdXJzaXZlIGV4dGVuZHMgc28gb25seSBhIHVzZXIncyB0b3AgbGV2ZWxcbiAgICAvLyBgYW5ndWxhckNvbXBpbGVyT3B0aW9uc2Agd2lsbCBiZSBjb25zaWRlcmVkLiBBcyB0aGlzIGNvZGUgaXMgZ29pbmcgdG8gYmVcbiAgICAvLyByZW1vdmVkIHdpdGggSXZ5LCB0aGUgYWRkZWQgY29tcGxpY2F0aW9uIG9mIGhhbmRsaW5nIHJlY3Vyc2l2ZSBleHRlbmRzXG4gICAgLy8gaXMgbGlrZWx5IG5vdCBuZWVkZWQuXG4gICAgbGV0IHVzZXJDb25maWdGaWxlID0gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKHBhdGguZGlybmFtZShwcm9qZWN0KSwgY29uZmlnWydleHRlbmRzJ10pO1xuICAgIGlmICghdXNlckNvbmZpZ0ZpbGUuZW5kc1dpdGgoJy5qc29uJykpIHVzZXJDb25maWdGaWxlICs9ICcuanNvbic7XG4gICAgY29uc3Qge2NvbmZpZzogdXNlckNvbmZpZywgZXJyb3J9ID0gdHMucmVhZENvbmZpZ0ZpbGUodXNlckNvbmZpZ0ZpbGUsIHRzLnN5cy5yZWFkRmlsZSk7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKFtlcnJvcl0pKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBBbGwgdXNlciBhbmd1bGFyQ29tcGlsZXJPcHRpb25zIHZhbHVlcyB0aGF0IGEgdXNlciBoYXMgY29udHJvbFxuICAgIC8vIG92ZXIgc2hvdWxkIGJlIGNvbGxlY3RlZCBoZXJlXG4gICAgaWYgKHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucykge1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlhZ25vc3RpY3MnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlhZ25vc3RpY3MnXSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlhZ25vc3RpY3M7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWyd0cmFjZSddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWyd0cmFjZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy50cmFjZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZyddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydkaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZztcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2Rpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2Rpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2s7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5PdXRMb2NhbGUnXSA9IGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5PdXRMb2NhbGUnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0TG9jYWxlO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bk91dEZvcm1hdCddID0gYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bk91dEZvcm1hdCddIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRGb3JtYXQ7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuT3V0RmlsZSddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuT3V0RmlsZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0RmlsZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluRm9ybWF0J10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkZvcm1hdCddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Gb3JtYXQ7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5Mb2NhbGUnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluTG9jYWxlJ10gfHwgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5JbkxvY2FsZTtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkZpbGUnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluRmlsZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5GaWxlO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4blVzZUV4dGVybmFsSWRzJ10gPSBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuVXNlRXh0ZXJuYWxJZHMnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHM7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ3ByZXNlcnZlV2hpdGVzcGFjZXMnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1sncHJlc2VydmVXaGl0ZXNwYWNlcyddIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXM7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRPdXRzID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ11bJ2V4cGVjdGVkT3V0J107XG5cbiAgY29uc3Qge2Jhc2VQYXRofSA9IG5nLmNhbGNQcm9qZWN0RmlsZUFuZEJhc2VQYXRoKHByb2plY3QpO1xuICBjb25zdCBjb21waWxlck9wdHMgPSBuZy5jcmVhdGVOZ0NvbXBpbGVyT3B0aW9ucyhiYXNlUGF0aCwgY29uZmlnLCB0c09wdGlvbnMpO1xuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgdHNIb3N0LFxuICAgIGJhemVsT3B0cyxcbiAgICBmaWxlcyxcbiAgICBpbnB1dHMsXG4gICAgZXhwZWN0ZWRPdXRzXG4gIH0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcykpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcy5ldmVyeShkID0+IGQuY2F0ZWdvcnkgIT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT0gMCkgcmV0dXJuIHJlbDtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKHthbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwgPSB0cnVlLCBjb21waWxlck9wdHMsIHRzSG9zdCwgYmF6ZWxPcHRzLCBmaWxlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dHMsIGV4cGVjdGVkT3V0cywgZ2F0aGVyRGlhZ25vc3RpY3N9OiB7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbD86IGJvb2xlYW4sXG4gIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLFxuICB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgZmlsZXM6IHN0cmluZ1tdLFxuICBleHBlY3RlZE91dHM6IHN0cmluZ1tdLCBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiBuZy5EaWFnbm9zdGljc1xufSk6IHtkaWFnbm9zdGljczogbmcuRGlhZ25vc3RpY3MsIHByb2dyYW06IG5nLlByb2dyYW19IHtcbiAgbGV0IGZpbGVMb2FkZXI6IEZpbGVMb2FkZXI7XG5cbiAgaWYgKGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbWF4Q2FjaGVTaXplQnl0ZXMgPSBiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgKiAoMSA8PCAyMCk7XG4gICAgZmlsZUNhY2hlLnNldE1heENhY2hlU2l6ZShtYXhDYWNoZVNpemVCeXRlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUNhY2hlLnJlc2V0TWF4Q2FjaGVTaXplKCk7XG4gIH1cblxuICBpZiAoaW5wdXRzKSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBDYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHM6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzW3Jlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpXSA9IGlucHV0c1trZXldO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlKSB7XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gdHJ1ZTtcbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGlvbnNBcyA9ICdzdGF0aWMgZmllbGRzJztcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gY29tcGlsZXJPcHRzLmVuYWJsZUl2eSA9PT0gJ25ndHNjJyB8fCBjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJztcblxuICAvLyBEaXNhYmxlIGRvd25sZXZlbGluZyBhbmQgQ2xvc3VyZSBhbm5vdGF0aW9uIGlmIGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAvLyBJbiBwYXNzLXRocm91Z2ggbW9kZSBmb3IgVHlwZVNjcmlwdCwgd2Ugd2FudCB0byB0dXJuIG9mZiBkZWNvcmF0b3IgdHJhbnNwaWxhdGlvbiBlbnRpcmVseS5cbiAgICAvLyBUaGlzIGNhdXNlcyBuZ2MgdG8gYmUgaGF2ZSBleGFjdGx5IGxpa2UgdHNjLlxuICAgIGlmIChjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJykge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0aW9uc0FzID0gJ2RlY29yYXRvcnMnO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IHdyaXR0ZW5FeHBlY3RlZE91dHMgPSBbLi4uZXhwZWN0ZWRPdXRzXTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUucmVwbGFjZSgvXFxcXC9nLCAnLycpLCBbY29tcGlsZXJPcHRzLnJvb3REaXJdKTtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRJZHggPSB3cml0dGVuRXhwZWN0ZWRPdXRzLmZpbmRJbmRleChvID0+IG8gPT09IHJlbGF0aXZlKTtcbiAgICAgICAgaWYgKGV4cGVjdGVkSWR4ID49IDApIHtcbiAgICAgICAgICB3cml0dGVuRXhwZWN0ZWRPdXRzLnNwbGljZShleHBlY3RlZElkeCwgMSk7XG4gICAgICAgICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gIC8vIFBhdGNoIGZpbGVFeGlzdHMgd2hlbiByZXNvbHZpbmcgbW9kdWxlcywgc28gdGhhdCBDb21waWxlckhvc3QgY2FuIGFzayBUeXBlU2NyaXB0IHRvXG4gIC8vIHJlc29sdmUgbm9uLWV4aXN0aW5nIGdlbmVyYXRlZCBmaWxlcyB0aGF0IGRvbid0IGV4aXN0IG9uIGRpc2ssIGJ1dCBhcmVcbiAgLy8gc3ludGhldGljIGFuZCBhZGRlZCB0byB0aGUgYHByb2dyYW1XaXRoU3R1YnNgIGJhc2VkIG9uIHJlYWwgaW5wdXRzLlxuICBjb25zdCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0ID0gT2JqZWN0LmNyZWF0ZSh0c0hvc3QpO1xuICBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gTkdDX0dFTl9GSUxFUy5leGVjKGZpbGVOYW1lKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFssIGZpbGUsIHN1ZmZpeCwgZXh0XSA9IG1hdGNoO1xuICAgICAgLy8gUGVyZm9ybWFuY2U6IHNraXAgbG9va2luZyBmb3IgZmlsZXMgb3RoZXIgdGhhbiAuZC50cyBvciAudHNcbiAgICAgIGlmIChleHQgIT09ICcudHMnICYmIGV4dCAhPT0gJy5kLnRzJykgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1ZmZpeC5pbmRleE9mKCduZ3N0eWxlJykgPj0gMCkge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uY3NzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmQudHMgb3IgZm9vLnRzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlICsgKGV4dCB8fCAnJyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKFxuICAgICAgbW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZTogc3RyaW5nLFxuICAgICAgY29tcGlsZXJPcHRpb25zOiB0cy5Db21waWxlck9wdGlvbnMpOiB0cy5SZXNvbHZlZE1vZHVsZVdpdGhGYWlsZWRMb29rdXBMb2NhdGlvbnMge1xuICAgIHJldHVybiB0cy5yZXNvbHZlTW9kdWxlTmFtZShcbiAgICAgICAgbW9kdWxlTmFtZSwgY29udGFpbmluZ0ZpbGUsIGNvbXBpbGVyT3B0aW9ucywgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCk7XG4gIH1cblxuICBjb25zdCBiYXplbEhvc3QgPSBuZXcgQ29tcGlsZXJIb3N0KFxuICAgICAgZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcik7XG5cbiAgLy8gQWxzbyBuZWVkIHRvIGRpc2FibGUgZGVjb3JhdG9yIGRvd25sZXZlbGluZyBpbiB0aGUgQmF6ZWxIb3N0IGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuICB9XG5cbiAgLy8gUHJldmVudCB0c2lja2xlIGFkZGluZyBhbnkgdHlwZXMgYXQgYWxsIGlmIHdlIGRvbid0IHdhbnQgY2xvc3VyZSBjb21waWxlciBhbm5vdGF0aW9ucy5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlID0gY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyO1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0ID0gYmF6ZWxIb3N0LmZpbGVFeGlzdHM7XG4gIGJhemVsSG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoTkdDX0FTU0VUUy50ZXN0KGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RGaWxlRXhpc3QuY2FsbChiYXplbEhvc3QsIGZpbGVOYW1lKTtcbiAgfTtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUgPSBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZS5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBmbGF0TW9kdWxlT3V0UGF0aCA9XG4gICAgICAgIHBhdGgucG9zaXguam9pbihiYXplbE9wdHMucGFja2FnZSwgY29tcGlsZXJPcHRzLmZsYXRNb2R1bGVPdXRGaWxlICsgJy50cycpO1xuXG4gICAgLy8gVGhlIGJ1bmRsZSBpbmRleCBmaWxlIGlzIHN5bnRoZXNpemVkIGluIGJ1bmRsZV9pbmRleF9ob3N0IHNvIGl0J3Mgbm90IGluIHRoZVxuICAgIC8vIGNvbXBpbGF0aW9uVGFyZ2V0U3JjLlxuICAgIC8vIEhvd2V2ZXIgd2Ugc3RpbGwgd2FudCB0byBnaXZlIGl0IGFuIEFNRCBtb2R1bGUgbmFtZSBmb3IgZGV2bW9kZS5cbiAgICAvLyBXZSBjYW4ndCBlYXNpbHkgdGVsbCB3aGljaCBmaWxlIGlzIHRoZSBzeW50aGV0aWMgb25lLCBzbyB3ZSBidWlsZCB1cCB0aGUgcGF0aCB3ZSBleHBlY3RcbiAgICAvLyBpdCB0byBoYXZlIGFuZCBjb21wYXJlIGFnYWluc3QgdGhhdC5cbiAgICBpZiAoZmlsZU5hbWUgPT09IHBhdGgucG9zaXguam9pbihjb21waWxlck9wdHMuYmFzZVVybCwgZmxhdE1vZHVsZU91dFBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEFsc28gaGFuZGxlIHRoZSBjYXNlIHRoZSB0YXJnZXQgaXMgaW4gYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeS5cbiAgICAvLyBQdWxsIHRoZSB3b3Jrc3BhY2UgbmFtZSBmcm9tIHRoZSB0YXJnZXQgd2hpY2ggaXMgZm9ybWF0dGVkIGFzIGBAd2tzcC8vcGFja2FnZTp0YXJnZXRgXG4gICAgLy8gaWYgaXQgdGhlIHRhcmdldCBpcyBmcm9tIGFuIGV4dGVybmFsIHdvcmtzcGFjZS4gSWYgdGhlIHRhcmdldCBpcyBmcm9tIHRoZSBsb2NhbFxuICAgIC8vIHdvcmtzcGFjZSB0aGVuIGl0IHdpbGwgYmUgZm9ybWF0dGVkIGFzIGAvL3BhY2thZ2U6dGFyZ2V0YC5cbiAgICBjb25zdCB0YXJnZXRXb3Jrc3BhY2UgPSBiYXplbE9wdHMudGFyZ2V0LnNwbGl0KCcvJylbMF0ucmVwbGFjZSgvXkAvLCAnJyk7XG5cbiAgICBpZiAodGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICAgIGZpbGVOYW1lID09PVxuICAgICAgICAgICAgcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCAnZXh0ZXJuYWwnLCB0YXJnZXRXb3Jrc3BhY2UsIGZsYXRNb2R1bGVPdXRQYXRoKSlcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlKGZpbGVOYW1lKSB8fCBOR0NfR0VOX0ZJTEVTLnRlc3QoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGNvbnN0IG5nSG9zdCA9IG5nLmNyZWF0ZUNvbXBpbGVySG9zdCh7b3B0aW9uczogY29tcGlsZXJPcHRzLCB0c0hvc3Q6IGJhemVsSG9zdH0pO1xuICBjb25zdCBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgbmdIb3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lID0gKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAvLyBNZW1vaXplIHRoaXMgbG9va3VwIHRvIGF2b2lkIGV4cGVuc2l2ZSByZS1wYXJzZXMgb2YgdGhlIHNhbWUgZmlsZVxuICAgIC8vIFdoZW4gcnVuIGFzIGEgd29ya2VyLCB0aGUgYWN0dWFsIHRzLlNvdXJjZUZpbGUgaXMgY2FjaGVkXG4gICAgLy8gYnV0IHdoZW4gd2UgZG9uJ3QgcnVuIGFzIGEgd29ya2VyLCB0aGVyZSBpcyBubyBjYWNoZS5cbiAgICAvLyBGb3Igb25lIGV4YW1wbGUgdGFyZ2V0IGluIGczLCB3ZSBzYXcgYSBjYWNoZSBoaXQgcmF0ZSBvZiA3NTkwLzc2OTVcbiAgICBpZiAoZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5oYXMoaW1wb3J0ZWRGaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmdldChpbXBvcnRlZEZpbGVQYXRoKTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoKTtcbiAgICBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLnNldChpbXBvcnRlZEZpbGVQYXRoLCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gbmdIb3N0LmdldFNvdXJjZUZpbGUoaW1wb3J0ZWRGaWxlUGF0aCwgdHMuU2NyaXB0VGFyZ2V0LkxhdGVzdCk7XG4gICAgICBpZiAoc291cmNlRmlsZSAmJiBzb3VyY2VGaWxlLm1vZHVsZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUZpbGUubW9kdWxlTmFtZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgcGFyc2UgZXJyb3IuIElnbm9yZSB0aGlzIGNhc2UgYW5kIGNvbnRpbnVlIG9udG8gdGhlXG4gICAgICAvLyBvdGhlciBtZXRob2RzIG9mIHJlc29sdmluZyB0aGUgbW9kdWxlIGJlbG93LlxuICAgIH1cbiAgICBpZiAoKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgICBuZ0hvc3QuYW1kTW9kdWxlTmFtZSkge1xuICAgICAgcmV0dXJuIG5nSG9zdC5hbWRNb2R1bGVOYW1lKHsgZmlsZU5hbWU6IGltcG9ydGVkRmlsZVBhdGggfSBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gcmVsYXRpdmVUb1Jvb3REaXJzKGltcG9ydGVkRmlsZVBhdGgsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKTtcbiAgICBpZiAocmVzdWx0LnN0YXJ0c1dpdGgoTk9ERV9NT0RVTEVTKSkge1xuICAgICAgcmV0dXJuIHJlc3VsdC5zdWJzdHIoTk9ERV9NT0RVTEVTLmxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiBiYXplbE9wdHMud29ya3NwYWNlTmFtZSArICcvJyArIHJlc3VsdDtcbiAgfVxuXG4gIG5nSG9zdC50b1N1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSA9PiBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZSwgY29tcGlsZXJPcHRzLnJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpKTtcbiAgaWYgKGFsbERlcHNDb21waWxlZFdpdGhCYXplbCkge1xuICAgIC8vIE5vdGU6IFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCxcbiAgICAvLyBidXQgd2UgY2FuIGJlIGZhc3RlciBhcyB3ZSBrbm93IGhvdyBgdG9TdW1tYXJ5RmlsZU5hbWVgIHdvcmtzLlxuICAgIC8vIE5vdGU6IFdlIGNhbid0IGRvIHRoaXMgaWYgc29tZSBkZXBzIGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIHRoZSBjb21tYW5kIGxpbmUsXG4gICAgLy8gYXMgdGhhdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgZnJvbVN1bW1hcnlGaWxlTmFtZSAvIHRvU3VtbWFyeUZpbGVOYW1lXG4gICAgbmdIb3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBmaWxlTmFtZS5zcGxpdCgnLycpLnNwbGljZSgxKS5qb2luKCcvJyk7XG4gICAgICByZXR1cm4gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCB3b3Jrc3BhY2VSZWxhdGl2ZSkgKyAnLmQudHMnO1xuICAgIH07XG4gIH1cbiAgLy8gUGF0Y2ggYSBwcm9wZXJ0eSBvbiB0aGUgbmdIb3N0IHRoYXQgYWxsb3dzIHRoZSByZXNvdXJjZU5hbWVUb01vZHVsZU5hbWUgZnVuY3Rpb24gdG9cbiAgLy8gcmVwb3J0IGJldHRlciBlcnJvcnMuXG4gIChuZ0hvc3QgYXMgYW55KS5yZXBvcnRNaXNzaW5nUmVzb3VyY2UgPSAocmVzb3VyY2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGBcXG5Bc3NldCBub3QgZm91bmQ6XFxuICAke3Jlc291cmNlTmFtZX1gKTtcbiAgICBjb25zb2xlLmVycm9yKCdDaGVjayB0aGF0IGl0XFwncyBpbmNsdWRlZCBpbiB0aGUgYGFzc2V0c2AgYXR0cmlidXRlIG9mIHRoZSBgbmdfbW9kdWxlYCBydWxlLlxcbicpO1xuICB9O1xuXG4gIGNvbnN0IGVtaXRDYWxsYmFjazogbmcuVHNFbWl0Q2FsbGJhY2sgPSAoe1xuICAgIHByb2dyYW0sXG4gICAgdGFyZ2V0U291cmNlRmlsZSxcbiAgICB3cml0ZUZpbGUsXG4gICAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gICAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgfSkgPT5cbiAgICAgIHRzaWNrbGUuZW1pdFdpdGhUc2lja2xlKFxuICAgICAgICAgIHByb2dyYW0sIGJhemVsSG9zdCwgYmF6ZWxIb3N0LCBjb21waWxlck9wdHMsIHRhcmdldFNvdXJjZUZpbGUsIHdyaXRlRmlsZSxcbiAgICAgICAgICBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywge1xuICAgICAgICAgICAgYmVmb3JlVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5iZWZvcmUsXG4gICAgICAgICAgICBhZnRlclRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXIsXG4gICAgICAgICAgfSk7XG5cbiAgaWYgKCFnYXRoZXJEaWFnbm9zdGljcykge1xuICAgIGdhdGhlckRpYWdub3N0aWNzID0gKHByb2dyYW0pID0+XG4gICAgICAgIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShjb21waWxlck9wdHMsIGJhemVsT3B0cywgcHJvZ3JhbSk7XG4gIH1cbiAgY29uc3Qge2RpYWdub3N0aWNzLCBlbWl0UmVzdWx0LCBwcm9ncmFtfSA9IG5nLnBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgcm9vdE5hbWVzOiBmaWxlcyxcbiAgICBvcHRpb25zOiBjb21waWxlck9wdHMsXG4gICAgaG9zdDogbmdIb3N0LCBlbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrOiB0c2lja2xlLm1lcmdlRW1pdFJlc3VsdHMsIGdhdGhlckRpYWdub3N0aWNzXG4gIH0pO1xuICBjb25zdCB0c2lja2xlRW1pdFJlc3VsdCA9IGVtaXRSZXN1bHQgYXMgdHNpY2tsZS5FbWl0UmVzdWx0O1xuICBsZXQgZXh0ZXJucyA9ICcvKiogQGV4dGVybnMgKi9cXG4nO1xuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGlmIChiYXplbE9wdHMudHNpY2tsZUdlbmVyYXRlRXh0ZXJucykge1xuICAgICAgZXh0ZXJucyArPSB0c2lja2xlLmdldEdlbmVyYXRlZEV4dGVybnModHNpY2tsZUVtaXRSZXN1bHQuZXh0ZXJucyk7XG4gICAgfVxuICAgIGlmIChiYXplbE9wdHMubWFuaWZlc3QpIHtcbiAgICAgIGNvbnN0IG1hbmlmZXN0ID0gY29uc3RydWN0TWFuaWZlc3QodHNpY2tsZUVtaXRSZXN1bHQubW9kdWxlc01hbmlmZXN0LCBiYXplbEhvc3QpO1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMubWFuaWZlc3QsIG1hbmlmZXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBjb21waWxhdGlvbiBmYWlscyB1bmV4cGVjdGVkbHksIHBlcmZvcm1Db21waWxhdGlvbiByZXR1cm5zIG5vIHByb2dyYW0uXG4gIC8vIE1ha2Ugc3VyZSBub3QgdG8gY3Jhc2ggYnV0IHJlcG9ydCB0aGUgZGlhZ25vc3RpY3MuXG4gIGlmICghcHJvZ3JhbSkgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG5cbiAgaWYgKCFiYXplbE9wdHMubm9kZU1vZHVsZXNQcmVmaXgpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBub2RlIG1vZHVsZXMsIHRoZW4gbWV0YWRhdGEuanNvbiBzaG91bGQgYmUgZW1pdHRlZCBzaW5jZVxuICAgIC8vIHRoZXJlIGlzIG5vIG90aGVyIHdheSB0byBvYnRhaW4gdGhlIGluZm9ybWF0aW9uXG4gICAgZ2VuZXJhdGVNZXRhZGF0YUpzb24ocHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSwgZmlsZXMsIGNvbXBpbGVyT3B0cy5yb290RGlycywgYmF6ZWxCaW4sIHRzSG9zdCk7XG4gIH1cblxuICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCkge1xuICAgIC8vIE5vdGU6IHdoZW4gdHNpY2tsZUV4dGVybnNQYXRoIGlzIHByb3ZpZGVkLCB3ZSBhbHdheXMgd3JpdGUgYSBmaWxlIGFzIGFcbiAgICAvLyBtYXJrZXIgdGhhdCBjb21waWxhdGlvbiBzdWNjZWVkZWQsIGV2ZW4gaWYgaXQncyBlbXB0eSAoanVzdCBjb250YWluaW5nIGFuXG4gICAgLy8gQGV4dGVybnMpLlxuICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCwgZXh0ZXJucyk7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHdyaXR0ZW5FeHBlY3RlZE91dHMubGVuZ3RoOyBpKyspIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZSh3cml0dGVuRXhwZWN0ZWRPdXRzW2ldLCAnJywgZmFsc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG59XG5cbi8qKlxuICogR2VuZXJhdGUgbWV0YWRhdGEuanNvbiBmb3IgdGhlIHNwZWNpZmllZCBgZmlsZXNgLiBCeSBkZWZhdWx0LCBtZXRhZGF0YS5qc29uXG4gKiBpcyBvbmx5IGdlbmVyYXRlZCBieSB0aGUgY29tcGlsZXIgaWYgLS1mbGF0TW9kdWxlT3V0RmlsZSBpcyBzcGVjaWZpZWQuIEJ1dFxuICogaWYgY29tcGlsZWQgdW5kZXIgYmxhemUsIHdlIHdhbnQgdGhlIG1ldGFkYXRhIHRvIGJlIGdlbmVyYXRlZCBmb3IgZWFjaFxuICogQW5ndWxhciBjb21wb25lbnQuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlTWV0YWRhdGFKc29uKFxuICAgIHByb2dyYW06IHRzLlByb2dyYW0sIGZpbGVzOiBzdHJpbmdbXSwgcm9vdERpcnM6IHN0cmluZ1tdLCBiYXplbEJpbjogc3RyaW5nLFxuICAgIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0KSB7XG4gIGNvbnN0IGNvbGxlY3RvciA9IG5ldyBuZy5NZXRhZGF0YUNvbGxlY3RvcigpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2ldO1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgaWYgKHNvdXJjZUZpbGUpIHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhID0gY29sbGVjdG9yLmdldE1ldGFkYXRhKHNvdXJjZUZpbGUpO1xuICAgICAgaWYgKG1ldGFkYXRhKSB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlID0gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGUsIHJvb3REaXJzKTtcbiAgICAgICAgY29uc3Qgc2hvcnRQYXRoID0gcmVsYXRpdmUucmVwbGFjZShFWFQsICcubWV0YWRhdGEuanNvbicpO1xuICAgICAgICBjb25zdCBvdXRGaWxlID0gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCBzaG9ydFBhdGgpO1xuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpO1xuICAgICAgICB0c0hvc3Qud3JpdGVGaWxlKG91dEZpbGUsIGRhdGEsIGZhbHNlLCB1bmRlZmluZWQsIFtdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuICFOR0NfR0VOX0ZJTEVTLnRlc3Qoc2YuZmlsZU5hbWUpICYmXG4gICAgICAoYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluZGV4T2Yoc2YuZmlsZU5hbWUpICE9PSAtMSk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgICBvcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICAgIG5nUHJvZ3JhbTogbmcuUHJvZ3JhbSk6IChuZy5EaWFnbm9zdGljIHwgdHMuRGlhZ25vc3RpYylbXSB7XG4gIGNvbnN0IHRzUHJvZ3JhbSA9IG5nUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IChuZy5EaWFnbm9zdGljIHwgdHMuRGlhZ25vc3RpYylbXSA9IFtdO1xuICAvLyBUaGVzZSBjaGVja3MgbWlycm9yIHRzLmdldFByZUVtaXREaWFnbm9zdGljcywgd2l0aCB0aGUgaW1wb3J0YW50XG4gIC8vIGV4Y2VwdGlvbiBvZiBhdm9pZGluZyBiLzMwNzA4MjQwLCB3aGljaCBpcyB0aGF0IGlmIHlvdSBjYWxsXG4gIC8vIHByb2dyYW0uZ2V0RGVjbGFyYXRpb25EaWFnbm9zdGljcygpIGl0IHNvbWVob3cgY29ycnVwdHMgdGhlIGVtaXQuXG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpKTtcbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKSk7XG4gIGNvbnN0IHByb2dyYW1GaWxlcyA9IHRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihmID0+IGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzLCBmKSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvZ3JhbUZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgc2YgPSBwcm9ncmFtRmlsZXNbaV07XG4gICAgLy8gTm90ZTogV2Ugb25seSBnZXQgdGhlIGRpYWdub3N0aWNzIGZvciBpbmRpdmlkdWFsIGZpbGVzXG4gICAgLy8gdG8gZS5nLiBub3QgY2hlY2sgbGlicmFyaWVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNmKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzZikpO1xuICB9XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgLy8gb25seSBnYXRoZXIgdGhlIGFuZ3VsYXIgZGlhZ25vc3RpY3MgaWYgd2UgaGF2ZSBubyBkaWFnbm9zdGljc1xuICAgIC8vIGluIGFueSBvdGhlciBmaWxlcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgcHJvY2Vzcy5leGl0Q29kZSA9IG1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKTtcbn1cbiJdfQ==