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
                angularCompilerOptions.createExternalSymbolFactoryReexports =
                    angularCompilerOptions.createExternalSymbolFactoryReexports ||
                        userConfig.angularCompilerOptions.createExternalSymbolFactoryReexports;
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
        const writtenExpectedOuts = expectedOuts.map(p => p.replace(/\\/g, '/'));
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
            afterDeclarations: customTransformers.afterDeclarations,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCw0Q0FBNEM7SUFDNUMsa0RBQXNOO0lBQ3ROLHlCQUF5QjtJQUN6Qiw2QkFBNkI7SUFDN0IsK0NBQW1DO0lBQ25DLGlDQUFpQztJQUVqQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztJQUMvQyxNQUFNLGFBQWEsR0FBRywwREFBMEQsQ0FBQztJQUNqRiwyRUFBMkU7SUFDM0UsbUJBQW1CO0lBQ25CLE1BQU0sVUFBVSxHQUFHLCtCQUErQixDQUFDO0lBRW5ELE1BQU0sU0FBUyxHQUFHLGlDQUFpQyxDQUFDO0lBRXBELDRFQUE0RTtJQUM1RSxNQUFNLDRCQUE0QixHQUFHLEtBQUssQ0FBQztJQUUzQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7SUFFckMsU0FBZ0IsSUFBSSxDQUFDLElBQUk7UUFDdkIsSUFBSSx3QkFBVyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3JCLDBCQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDNUI7YUFBTTtZQUNMLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNsQztRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQVBELG9CQU9DO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBZ0Isa0JBQUssQ0FBQyxDQUFDO0lBRXRELFNBQWdCLFdBQVcsQ0FBQyxJQUFjLEVBQUUsTUFBaUM7UUFDM0UsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSTtZQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyx5REFBeUQ7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LENBQUMsQ0FBQyxDQUFDO1lBQzNELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUMzRDtRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ3ZCLGdFQUFnRTtZQUNoRSxzQkFBc0I7WUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7WUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7U0FDM0Q7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2hEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtCYXplbE9wdGlvbnMsIENhY2hlZEZpbGVMb2FkZXIsIENvbXBpbGVySG9zdCwgRmlsZUNhY2hlLCBGaWxlTG9hZGVyLCBVbmNhY2hlZEZpbGVMb2FkZXIsIGNvbnN0cnVjdE1hbmlmZXN0LCBkZWJ1ZywgcGFyc2VUc2NvbmZpZywgcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoLCBydW5Bc1dvcmtlciwgcnVuV29ya2VyTG9vcH0gZnJvbSAnQGJhemVsL3R5cGVzY3JpcHQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzaWNrbGUgZnJvbSAndHNpY2tsZSc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuY29uc3QgRVhUID0gLyhcXC50c3xcXC5kXFwudHN8XFwuanN8XFwuanN4fFxcLnRzeCkkLztcbmNvbnN0IE5HQ19HRU5fRklMRVMgPSAvXiguKj8pXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnl8bmdzdHlsZXxzaGltXFwubmdzdHlsZSkoLiopJC87XG4vLyBGSVhNRTogd2Ugc2hvdWxkIGJlIGFibGUgdG8gYWRkIHRoZSBhc3NldHMgdG8gdGhlIHRzY29uZmlnIHNvIEZpbGVMb2FkZXJcbi8vIGtub3dzIGFib3V0IHRoZW1cbmNvbnN0IE5HQ19BU1NFVFMgPSAvXFwuKGNzc3xodG1sfG5nc3VtbWFyeVxcLmpzb24pJC87XG5cbmNvbnN0IEJBWkVMX0JJTiA9IC9cXGIoYmxhemV8YmF6ZWwpLW91dFxcYi4qP1xcYmJpblxcYi87XG5cbi8vIE5vdGU6IFdlIGNvbXBpbGUgdGhlIGNvbnRlbnQgb2Ygbm9kZV9tb2R1bGVzIHdpdGggcGxhaW4gbmdjIGNvbW1hbmQgbGluZS5cbmNvbnN0IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwgPSBmYWxzZTtcblxuY29uc3QgTk9ERV9NT0RVTEVTID0gJ25vZGVfbW9kdWxlcy8nO1xuXG5leHBvcnQgZnVuY3Rpb24gbWFpbihhcmdzKSB7XG4gIGlmIChydW5Bc1dvcmtlcihhcmdzKSkge1xuICAgIHJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBydW5PbmVCdWlsZChhcmdzKSA/IDAgOiAxO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG4vKiogVGhlIG9uZSBGaWxlQ2FjaGUgaW5zdGFuY2UgdXNlZCBpbiB0aGlzIHByb2Nlc3MuICovXG5jb25zdCBmaWxlQ2FjaGUgPSBuZXcgRmlsZUNhY2hlPHRzLlNvdXJjZUZpbGU+KGRlYnVnKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk9uZUJ1aWxkKGFyZ3M6IHN0cmluZ1tdLCBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30pOiBib29sZWFuIHtcbiAgaWYgKGFyZ3NbMF0gPT09ICctcCcpIGFyZ3Muc2hpZnQoKTtcbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcblxuICBjb25zdCBbcGFyc2VkT3B0aW9ucywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcocHJvamVjdCk7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHtvcHRpb25zOiB0c09wdGlvbnMsIGJhemVsT3B0cywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCBhbmd1bGFyQ29tcGlsZXJPcHRpb25zOiB7W2s6IHN0cmluZ106IHVua25vd259ID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ10gfHwge307XG5cbiAgLy8gQWxsb3cgQmF6ZWwgdXNlcnMgdG8gY29udHJvbCBzb21lIG9mIHRoZSBiYXplbCBvcHRpb25zLlxuICAvLyBTaW5jZSBUeXBlU2NyaXB0J3MgXCJleHRlbmRzXCIgbWVjaGFuaXNtIGFwcGxpZXMgb25seSB0byBcImNvbXBpbGVyT3B0aW9uc1wiXG4gIC8vIHdlIGhhdmUgdG8gcmVwZWF0IHNvbWUgb2YgdGhlaXIgbG9naWMgdG8gZ2V0IHRoZSB1c2VyJ3MgXCJhbmd1bGFyQ29tcGlsZXJPcHRpb25zXCIuXG4gIGlmIChjb25maWdbJ2V4dGVuZHMnXSkge1xuICAgIC8vIExvYWQgdGhlIHVzZXIncyBjb25maWcgZmlsZVxuICAgIC8vIE5vdGU6IHRoaXMgZG9lc24ndCBoYW5kbGUgcmVjdXJzaXZlIGV4dGVuZHMgc28gb25seSBhIHVzZXIncyB0b3AgbGV2ZWxcbiAgICAvLyBgYW5ndWxhckNvbXBpbGVyT3B0aW9uc2Agd2lsbCBiZSBjb25zaWRlcmVkLiBBcyB0aGlzIGNvZGUgaXMgZ29pbmcgdG8gYmVcbiAgICAvLyByZW1vdmVkIHdpdGggSXZ5LCB0aGUgYWRkZWQgY29tcGxpY2F0aW9uIG9mIGhhbmRsaW5nIHJlY3Vyc2l2ZSBleHRlbmRzXG4gICAgLy8gaXMgbGlrZWx5IG5vdCBuZWVkZWQuXG4gICAgbGV0IHVzZXJDb25maWdGaWxlID0gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKHBhdGguZGlybmFtZShwcm9qZWN0KSwgY29uZmlnWydleHRlbmRzJ10pO1xuICAgIGlmICghdXNlckNvbmZpZ0ZpbGUuZW5kc1dpdGgoJy5qc29uJykpIHVzZXJDb25maWdGaWxlICs9ICcuanNvbic7XG4gICAgY29uc3Qge2NvbmZpZzogdXNlckNvbmZpZywgZXJyb3J9ID0gdHMucmVhZENvbmZpZ0ZpbGUodXNlckNvbmZpZ0ZpbGUsIHRzLnN5cy5yZWFkRmlsZSk7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKFtlcnJvcl0pKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBBbGwgdXNlciBhbmd1bGFyQ29tcGlsZXJPcHRpb25zIHZhbHVlcyB0aGF0IGEgdXNlciBoYXMgY29udHJvbFxuICAgIC8vIG92ZXIgc2hvdWxkIGJlIGNvbGxlY3RlZCBoZXJlXG4gICAgaWYgKHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucykge1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlhZ25vc3RpY3MnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlhZ25vc3RpY3MnXSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlhZ25vc3RpY3M7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWyd0cmFjZSddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWyd0cmFjZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy50cmFjZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZyddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydkaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZztcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2Rpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2Rpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2s7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5PdXRMb2NhbGUnXSA9IGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5PdXRMb2NhbGUnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0TG9jYWxlO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bk91dEZvcm1hdCddID0gYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bk91dEZvcm1hdCddIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRGb3JtYXQ7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuT3V0RmlsZSddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuT3V0RmlsZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0RmlsZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluRm9ybWF0J10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkZvcm1hdCddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Gb3JtYXQ7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5Mb2NhbGUnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluTG9jYWxlJ10gfHwgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5JbkxvY2FsZTtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkZpbGUnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluRmlsZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5GaWxlO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4blVzZUV4dGVybmFsSWRzJ10gPSBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuVXNlRXh0ZXJuYWxJZHMnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHM7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ3ByZXNlcnZlV2hpdGVzcGFjZXMnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1sncHJlc2VydmVXaGl0ZXNwYWNlcyddIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXM7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmNyZWF0ZUV4dGVybmFsU3ltYm9sRmFjdG9yeVJlZXhwb3J0cyB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5jcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHM7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRPdXRzID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ11bJ2V4cGVjdGVkT3V0J107XG5cbiAgY29uc3Qge2Jhc2VQYXRofSA9IG5nLmNhbGNQcm9qZWN0RmlsZUFuZEJhc2VQYXRoKHByb2plY3QpO1xuICBjb25zdCBjb21waWxlck9wdHMgPSBuZy5jcmVhdGVOZ0NvbXBpbGVyT3B0aW9ucyhiYXNlUGF0aCwgY29uZmlnLCB0c09wdGlvbnMpO1xuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgdHNIb3N0LFxuICAgIGJhemVsT3B0cyxcbiAgICBmaWxlcyxcbiAgICBpbnB1dHMsXG4gICAgZXhwZWN0ZWRPdXRzXG4gIH0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcykpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcy5ldmVyeShkID0+IGQuY2F0ZWdvcnkgIT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT0gMCkgcmV0dXJuIHJlbDtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKHthbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwgPSB0cnVlLCBjb21waWxlck9wdHMsIHRzSG9zdCwgYmF6ZWxPcHRzLCBmaWxlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dHMsIGV4cGVjdGVkT3V0cywgZ2F0aGVyRGlhZ25vc3RpY3N9OiB7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbD86IGJvb2xlYW4sXG4gIGNvbXBpbGVyT3B0czogbmcuQ29tcGlsZXJPcHRpb25zLFxuICB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LFxuICBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgZmlsZXM6IHN0cmluZ1tdLFxuICBleHBlY3RlZE91dHM6IHN0cmluZ1tdLCBnYXRoZXJEaWFnbm9zdGljcz86IChwcm9ncmFtOiBuZy5Qcm9ncmFtKSA9PiBuZy5EaWFnbm9zdGljc1xufSk6IHtkaWFnbm9zdGljczogbmcuRGlhZ25vc3RpY3MsIHByb2dyYW06IG5nLlByb2dyYW19IHtcbiAgbGV0IGZpbGVMb2FkZXI6IEZpbGVMb2FkZXI7XG5cbiAgaWYgKGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbWF4Q2FjaGVTaXplQnl0ZXMgPSBiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgKiAoMSA8PCAyMCk7XG4gICAgZmlsZUNhY2hlLnNldE1heENhY2hlU2l6ZShtYXhDYWNoZVNpemVCeXRlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUNhY2hlLnJlc2V0TWF4Q2FjaGVTaXplKCk7XG4gIH1cblxuICBpZiAoaW5wdXRzKSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBDYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHM6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzW3Jlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpXSA9IGlucHV0c1trZXldO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlKSB7XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gdHJ1ZTtcbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGlvbnNBcyA9ICdzdGF0aWMgZmllbGRzJztcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gY29tcGlsZXJPcHRzLmVuYWJsZUl2eSA9PT0gJ25ndHNjJyB8fCBjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJztcblxuICAvLyBEaXNhYmxlIGRvd25sZXZlbGluZyBhbmQgQ2xvc3VyZSBhbm5vdGF0aW9uIGlmIGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAvLyBJbiBwYXNzLXRocm91Z2ggbW9kZSBmb3IgVHlwZVNjcmlwdCwgd2Ugd2FudCB0byB0dXJuIG9mZiBkZWNvcmF0b3IgdHJhbnNwaWxhdGlvbiBlbnRpcmVseS5cbiAgICAvLyBUaGlzIGNhdXNlcyBuZ2MgdG8gYmUgaGF2ZSBleGFjdGx5IGxpa2UgdHNjLlxuICAgIGlmIChjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJykge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0aW9uc0FzID0gJ2RlY29yYXRvcnMnO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IHdyaXR0ZW5FeHBlY3RlZE91dHMgPSBleHBlY3RlZE91dHMubWFwKHAgPT4gcC5yZXBsYWNlKC9cXFxcL2csICcvJykpO1xuXG4gIGNvbnN0IG9yaWdpbmFsV3JpdGVGaWxlID0gdHNIb3N0LndyaXRlRmlsZS5iaW5kKHRzSG9zdCk7XG4gIHRzSG9zdC53cml0ZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLCBzb3VyY2VGaWxlcz86IHRzLlNvdXJjZUZpbGVbXSkgPT4ge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9IHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZS5yZXBsYWNlKC9cXFxcL2csICcvJyksIFtjb21waWxlck9wdHMucm9vdERpcl0pO1xuICAgICAgICBjb25zdCBleHBlY3RlZElkeCA9IHdyaXR0ZW5FeHBlY3RlZE91dHMuZmluZEluZGV4KG8gPT4gbyA9PT0gcmVsYXRpdmUpO1xuICAgICAgICBpZiAoZXhwZWN0ZWRJZHggPj0gMCkge1xuICAgICAgICAgIHdyaXR0ZW5FeHBlY3RlZE91dHMuc3BsaWNlKGV4cGVjdGVkSWR4LCAxKTtcbiAgICAgICAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgY29udGVudCwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QgPSBPYmplY3QuY3JlYXRlKHRzSG9zdCk7XG4gIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIoXG4gICAgICBtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcsXG4gICAgICBjb21waWxlck9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyk6IHRzLlJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyB7XG4gICAgcmV0dXJuIHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICBtb2R1bGVOYW1lLCBjb250YWluaW5nRmlsZSwgY29tcGlsZXJPcHRpb25zLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0KTtcbiAgfVxuXG4gIGNvbnN0IGJhemVsSG9zdCA9IG5ldyBDb21waWxlckhvc3QoXG4gICAgICBmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlciwgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKTtcblxuICAvLyBBbHNvIG5lZWQgdG8gZGlzYWJsZSBkZWNvcmF0b3IgZG93bmxldmVsaW5nIGluIHRoZSBCYXplbEhvc3QgaW4gSXZ5IG1vZGUuXG4gIGlmIChpc0luSXZ5TW9kZSkge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1EZWNvcmF0b3JzID0gZmFsc2U7XG4gIH1cblxuICAvLyBQcmV2ZW50IHRzaWNrbGUgYWRkaW5nIGFueSB0eXBlcyBhdCBhbGwgaWYgd2UgZG9uJ3Qgd2FudCBjbG9zdXJlIGNvbXBpbGVyIGFubm90YXRpb25zLlxuICBiYXplbEhvc3QudHJhbnNmb3JtVHlwZXNUb0Nsb3N1cmUgPSBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXI7XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID1cbiAgICAgICAgcGF0aC5wb3NpeC5qb2luKGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCBmbGF0TW9kdWxlT3V0UGF0aCkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcblxuICAgIGlmICh0YXJnZXRXb3Jrc3BhY2UgJiZcbiAgICAgICAgZmlsZU5hbWUgPT09XG4gICAgICAgICAgICBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg6IHN0cmluZykgPT4ge1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhpbXBvcnRlZEZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGltcG9ydGVkRmlsZVBhdGgpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGltcG9ydGVkRmlsZVBhdGgsIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBmdW5jdGlvbiBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9XG4gICAgICAgICAgICBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpLmltcG9ydEFzO1xuICAgICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICAgIHJldHVybiBtb2R1bGVOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLlVNRCB8fCBjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLkFNRCkgJiZcbiAgICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWUpIHtcbiAgICAgIHJldHVybiBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7IGZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRoIH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgaWYgKHJlc3VsdC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZXN1bHQuc3Vic3RyKE5PREVfTU9EVUxFUy5sZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUgKyAnLycgKyByZXN1bHQ7XG4gIH1cblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IG5nLlRzRW1pdENhbGxiYWNrID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QsIGJhemVsSG9zdCwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyLFxuICAgICAgICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlckRlY2xhcmF0aW9ucyxcbiAgICAgICAgICB9KTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtKTtcbiAgfVxuICBjb25zdCB7ZGlhZ25vc3RpY3MsIGVtaXRSZXN1bHQsIHByb2dyYW19ID0gbmcucGVyZm9ybUNvbXBpbGF0aW9uKHtcbiAgICByb290TmFtZXM6IGZpbGVzLFxuICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0cyxcbiAgICBob3N0OiBuZ0hvc3QsIGVtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s6IHRzaWNrbGUubWVyZ2VFbWl0UmVzdWx0cywgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoIWJhemVsT3B0cy5ub2RlTW9kdWxlc1ByZWZpeCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIG5vZGUgbW9kdWxlcywgdGhlbiBtZXRhZGF0YS5qc29uIHNob3VsZCBiZSBlbWl0dGVkIHNpbmNlXG4gICAgLy8gdGhlcmUgaXMgbm8gb3RoZXIgd2F5IHRvIG9idGFpbiB0aGUgaW5mb3JtYXRpb25cbiAgICBnZW5lcmF0ZU1ldGFkYXRhSnNvbihwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCBmaWxlcywgY29tcGlsZXJPcHRzLnJvb3REaXJzLCBiYXplbEJpbiwgdHNIb3N0KTtcbiAgfVxuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgd3JpdHRlbkV4cGVjdGVkT3V0cy5sZW5ndGg7IGkrKykge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKHdyaXR0ZW5FeHBlY3RlZE91dHNbaV0sICcnLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBtZXRhZGF0YS5qc29uIGZvciB0aGUgc3BlY2lmaWVkIGBmaWxlc2AuIEJ5IGRlZmF1bHQsIG1ldGFkYXRhLmpzb25cbiAqIGlzIG9ubHkgZ2VuZXJhdGVkIGJ5IHRoZSBjb21waWxlciBpZiAtLWZsYXRNb2R1bGVPdXRGaWxlIGlzIHNwZWNpZmllZC4gQnV0XG4gKiBpZiBjb21waWxlZCB1bmRlciBibGF6ZSwgd2Ugd2FudCB0aGUgbWV0YWRhdGEgdG8gYmUgZ2VuZXJhdGVkIGZvciBlYWNoXG4gKiBBbmd1bGFyIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVNZXRhZGF0YUpzb24oXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgZmlsZXM6IHN0cmluZ1tdLCByb290RGlyczogc3RyaW5nW10sIGJhemVsQmluOiBzdHJpbmcsXG4gICAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QpIHtcbiAgY29uc3QgY29sbGVjdG9yID0gbmV3IG5nLk1ldGFkYXRhQ29sbGVjdG9yKCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoc291cmNlRmlsZSkge1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBjb2xsZWN0b3IuZ2V0TWV0YWRhdGEoc291cmNlRmlsZSk7XG4gICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZSwgcm9vdERpcnMpO1xuICAgICAgICBjb25zdCBzaG9ydFBhdGggPSByZWxhdGl2ZS5yZXBsYWNlKEVYVCwgJy5tZXRhZGF0YS5qc29uJyk7XG4gICAgICAgIGNvbnN0IG91dEZpbGUgPSByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHNob3J0UGF0aCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSk7XG4gICAgICAgIHRzSG9zdC53cml0ZUZpbGUob3V0RmlsZSwgZGF0YSwgZmFsc2UsIHVuZGVmaW5lZCwgW10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIU5HQ19HRU5fRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiZcbiAgICAgIChiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICAgIG9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtKTogKG5nLkRpYWdub3N0aWMgfCB0cy5EaWFnbm9zdGljKVtdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuICBjb25zdCBkaWFnbm9zdGljczogKG5nLkRpYWdub3N0aWMgfCB0cy5EaWFnbm9zdGljKVtdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKGYgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gIH1cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBwcm9jZXNzLmV4aXRDb2RlID0gbWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpO1xufVxuIl19