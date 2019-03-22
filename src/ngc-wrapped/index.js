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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCw0Q0FBNEM7SUFDNUMsa0RBQXNOO0lBQ3ROLHlCQUF5QjtJQUN6Qiw2QkFBNkI7SUFDN0IsK0NBQW1DO0lBQ25DLGlDQUFpQztJQUVqQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztJQUMvQyxNQUFNLGFBQWEsR0FBRywwREFBMEQsQ0FBQztJQUNqRiwyRUFBMkU7SUFDM0UsbUJBQW1CO0lBQ25CLE1BQU0sVUFBVSxHQUFHLCtCQUErQixDQUFDO0lBRW5ELE1BQU0sU0FBUyxHQUFHLGlDQUFpQyxDQUFDO0lBRXBELDRFQUE0RTtJQUM1RSxNQUFNLDRCQUE0QixHQUFHLEtBQUssQ0FBQztJQUUzQyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7SUFFckMsU0FBZ0IsSUFBSSxDQUFDLElBQUk7UUFDdkIsSUFBSSx3QkFBVyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3JCLDBCQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDNUI7YUFBTTtZQUNMLE9BQU8sV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNsQztRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQVBELG9CQU9DO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBZ0Isa0JBQUssQ0FBQyxDQUFDO0lBRXRELFNBQWdCLFdBQVcsQ0FBQyxJQUFjLEVBQUUsTUFBaUM7UUFDM0UsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSTtZQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyx5REFBeUQ7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MEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1lBQzVELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO1NBQzNEO1FBQ0QsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsT0FBTyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNoRCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7QmF6ZWxPcHRpb25zLCBDYWNoZWRGaWxlTG9hZGVyLCBDb21waWxlckhvc3QsIEZpbGVDYWNoZSwgRmlsZUxvYWRlciwgVW5jYWNoZWRGaWxlTG9hZGVyLCBjb25zdHJ1Y3RNYW5pZmVzdCwgZGVidWcsIHBhcnNlVHNjb25maWcsIHJlc29sdmVOb3JtYWxpemVkUGF0aCwgcnVuQXNXb3JrZXIsIHJ1bldvcmtlckxvb3B9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5PbmVCdWlsZChhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogYm9vbGVhbiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSBhcmdzLnNoaWZ0KCk7XG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB7b3B0aW9uczogdHNPcHRpb25zLCBiYXplbE9wdHMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3QgYW5ndWxhckNvbXBpbGVyT3B0aW9uczoge1trOiBzdHJpbmddOiB1bmtub3dufSA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddIHx8IHt9O1xuXG4gIC8vIEFsbG93IEJhemVsIHVzZXJzIHRvIGNvbnRyb2wgc29tZSBvZiB0aGUgYmF6ZWwgb3B0aW9ucy5cbiAgLy8gU2luY2UgVHlwZVNjcmlwdCdzIFwiZXh0ZW5kc1wiIG1lY2hhbmlzbSBhcHBsaWVzIG9ubHkgdG8gXCJjb21waWxlck9wdGlvbnNcIlxuICAvLyB3ZSBoYXZlIHRvIHJlcGVhdCBzb21lIG9mIHRoZWlyIGxvZ2ljIHRvIGdldCB0aGUgdXNlcidzIFwiYW5ndWxhckNvbXBpbGVyT3B0aW9uc1wiLlxuICBpZiAoY29uZmlnWydleHRlbmRzJ10pIHtcbiAgICAvLyBMb2FkIHRoZSB1c2VyJ3MgY29uZmlnIGZpbGVcbiAgICAvLyBOb3RlOiB0aGlzIGRvZXNuJ3QgaGFuZGxlIHJlY3Vyc2l2ZSBleHRlbmRzIHNvIG9ubHkgYSB1c2VyJ3MgdG9wIGxldmVsXG4gICAgLy8gYGFuZ3VsYXJDb21waWxlck9wdGlvbnNgIHdpbGwgYmUgY29uc2lkZXJlZC4gQXMgdGhpcyBjb2RlIGlzIGdvaW5nIHRvIGJlXG4gICAgLy8gcmVtb3ZlZCB3aXRoIEl2eSwgdGhlIGFkZGVkIGNvbXBsaWNhdGlvbiBvZiBoYW5kbGluZyByZWN1cnNpdmUgZXh0ZW5kc1xuICAgIC8vIGlzIGxpa2VseSBub3QgbmVlZGVkLlxuICAgIGxldCB1c2VyQ29uZmlnRmlsZSA9IHJlc29sdmVOb3JtYWxpemVkUGF0aChwYXRoLmRpcm5hbWUocHJvamVjdCksIGNvbmZpZ1snZXh0ZW5kcyddKTtcbiAgICBpZiAoIXVzZXJDb25maWdGaWxlLmVuZHNXaXRoKCcuanNvbicpKSB1c2VyQ29uZmlnRmlsZSArPSAnLmpzb24nO1xuICAgIGNvbnN0IHtjb25maWc6IHVzZXJDb25maWcsIGVycm9yfSA9IHRzLnJlYWRDb25maWdGaWxlKHVzZXJDb25maWdGaWxlLCB0cy5zeXMucmVhZEZpbGUpO1xuICAgIGlmIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhbZXJyb3JdKSk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQWxsIHVzZXIgYW5ndWxhckNvbXBpbGVyT3B0aW9ucyB2YWx1ZXMgdGhhdCBhIHVzZXIgaGFzIGNvbnRyb2xcbiAgICAvLyBvdmVyIHNob3VsZCBiZSBjb2xsZWN0ZWQgaGVyZVxuICAgIGlmICh1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMpIHtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlhZ25vc3RpY3MgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlhZ25vc3RpY3MgfHwgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpYWdub3N0aWNzO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy50cmFjZSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy50cmFjZSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMudHJhY2U7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZyA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5kaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVFeHByZXNzaW9uTG93ZXJpbmc7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5PdXRMb2NhbGUgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dExvY2FsZSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dExvY2FsZTtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dEZvcm1hdCA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0Rm9ybWF0IHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0Rm9ybWF0O1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0RmlsZSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0RmlsZSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dEZpbGU7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRm9ybWF0ID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5JbkZvcm1hdCB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRm9ybWF0O1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Mb2NhbGUgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluTG9jYWxlIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Mb2NhbGU7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5JbkZpbGUgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRmlsZSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRmlsZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmkxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMgfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucztcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4blVzZUV4dGVybmFsSWRzID0gYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuVXNlRXh0ZXJuYWxJZHMgfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4blVzZUV4dGVybmFsSWRzO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXMgPSBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXMgfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcztcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5jcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMgPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnMuY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmNyZWF0ZUV4dGVybmFsU3ltYm9sRmFjdG9yeVJlZXhwb3J0cztcbiAgICB9XG4gIH1cblxuICBjb25zdCBleHBlY3RlZE91dHMgPSBjb25maWdbJ2FuZ3VsYXJDb21waWxlck9wdGlvbnMnXVsnZXhwZWN0ZWRPdXQnXTtcblxuICBjb25zdCB7YmFzZVBhdGh9ID0gbmcuY2FsY1Byb2plY3RGaWxlQW5kQmFzZVBhdGgocHJvamVjdCk7XG4gIGNvbnN0IGNvbXBpbGVyT3B0cyA9IG5nLmNyZWF0ZU5nQ29tcGlsZXJPcHRpb25zKGJhc2VQYXRoLCBjb25maWcsIHRzT3B0aW9ucyk7XG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICB0c0hvc3QsXG4gICAgYmF6ZWxPcHRzLFxuICAgIGZpbGVzLFxuICAgIGlucHV0cyxcbiAgICBleHBlY3RlZE91dHNcbiAgfSk7XG4gIGlmIChkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGRpYWdub3N0aWNzKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzLmV2ZXJ5KGQgPT4gZC5jYXRlZ29yeSAhPT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlUGF0aDogc3RyaW5nLCByb290RGlyczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gZmlsZVBhdGg7XG4gIC8vIE5COiB0aGUgcm9vdERpcnMgc2hvdWxkIGhhdmUgYmVlbiBzb3J0ZWQgbG9uZ2VzdC1maXJzdFxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3REaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZGlyID0gcm9vdERpcnNbaV07XG4gICAgY29uc3QgcmVsID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShkaXIsIGZpbGVQYXRoKTtcbiAgICBpZiAocmVsLmluZGV4T2YoJy4nKSAhPSAwKSByZXR1cm4gcmVsO1xuICB9XG4gIHJldHVybiBmaWxlUGF0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGUoe2FsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsIGNvbXBpbGVyT3B0cywgdHNIb3N0LCBiYXplbE9wdHMsIGZpbGVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0cywgZXhwZWN0ZWRPdXRzLCBnYXRoZXJEaWFnbm9zdGljc306IHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsPzogYm9vbGVhbixcbiAgY29tcGlsZXJPcHRzOiBuZy5Db21waWxlck9wdGlvbnMsXG4gIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0LCBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sXG4gIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICBmaWxlczogc3RyaW5nW10sXG4gIGV4cGVjdGVkT3V0czogc3RyaW5nW10sIGdhdGhlckRpYWdub3N0aWNzPzogKHByb2dyYW06IG5nLlByb2dyYW0pID0+IG5nLkRpYWdub3N0aWNzXG59KToge2RpYWdub3N0aWNzOiBuZy5EaWFnbm9zdGljcywgcHJvZ3JhbTogbmcuUHJvZ3JhbX0ge1xuICBsZXQgZmlsZUxvYWRlcjogRmlsZUxvYWRlcjtcblxuICBpZiAoYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBtYXhDYWNoZVNpemVCeXRlcyA9IGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAqICgxIDw8IDIwKTtcbiAgICBmaWxlQ2FjaGUuc2V0TWF4Q2FjaGVTaXplKG1heENhY2hlU2l6ZUJ5dGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlQ2FjaGUucmVzZXRNYXhDYWNoZVNpemUoKTtcbiAgfVxuXG4gIGlmIChpbnB1dHMpIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IENhY2hlZEZpbGVMb2FkZXIoZmlsZUNhY2hlKTtcbiAgICAvLyBSZXNvbHZlIHRoZSBpbnB1dHMgdG8gYWJzb2x1dGUgcGF0aHMgdG8gbWF0Y2ggVHlwZVNjcmlwdCBpbnRlcm5hbHNcbiAgICBjb25zdCByZXNvbHZlZElucHV0czoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMoaW5wdXRzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0S2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qga2V5ID0gaW5wdXRLZXlzW2ldO1xuICAgICAgcmVzb2x2ZWRJbnB1dHNbcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGtleSldID0gaW5wdXRzW2tleV07XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBVbmNhY2hlZEZpbGVMb2FkZXIoKTtcbiAgfVxuXG4gIGlmICghYmF6ZWxPcHRzLmVzNU1vZGUpIHtcbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0aW9uc0FzID0gJ3N0YXRpYyBmaWVsZHMnO1xuICB9XG5cbiAgLy8gRGV0ZWN0IGZyb20gY29tcGlsZXJPcHRzIHdoZXRoZXIgdGhlIGVudHJ5cG9pbnQgaXMgYmVpbmcgaW52b2tlZCBpbiBJdnkgbW9kZS5cbiAgY29uc3QgaXNJbkl2eU1vZGUgPSBjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAnbmd0c2MnIHx8IGNvbXBpbGVyT3B0cy5lbmFibGVJdnkgPT09ICd0c2MnO1xuXG4gIC8vIERpc2FibGUgZG93bmxldmVsaW5nIGFuZCBDbG9zdXJlIGFubm90YXRpb24gaWYgaW4gSXZ5IG1vZGUuXG4gIGlmIChpc0luSXZ5TW9kZSkge1xuICAgIC8vIEluIHBhc3MtdGhyb3VnaCBtb2RlIGZvciBUeXBlU2NyaXB0LCB3ZSB3YW50IHRvIHR1cm4gb2ZmIGRlY29yYXRvciB0cmFuc3BpbGF0aW9uIGVudGlyZWx5LlxuICAgIC8vIFRoaXMgY2F1c2VzIG5nYyB0byBiZSBoYXZlIGV4YWN0bHkgbGlrZSB0c2MuXG4gICAgaWYgKGNvbXBpbGVyT3B0cy5lbmFibGVJdnkgPT09ICd0c2MnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRpb25zQXMgPSAnZGVjb3JhdG9ycyc7XG4gIH1cblxuICBpZiAoIWNvbXBpbGVyT3B0cy5yb290RGlycykge1xuICAgIHRocm93IG5ldyBFcnJvcigncm9vdERpcnMgaXMgbm90IHNldCEnKTtcbiAgfVxuICBjb25zdCBiYXplbEJpbiA9IGNvbXBpbGVyT3B0cy5yb290RGlycy5maW5kKHJvb3REaXIgPT4gQkFaRUxfQklOLnRlc3Qocm9vdERpcikpO1xuICBpZiAoIWJhemVsQmluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGJhemVsIGJpbiBpbiB0aGUgcm9vdERpcnM6ICR7Y29tcGlsZXJPcHRzLnJvb3REaXJzfWApO1xuICB9XG5cbiAgY29uc3Qgd3JpdHRlbkV4cGVjdGVkT3V0cyA9IFsuLi5leHBlY3RlZE91dHNdO1xuXG4gIGNvbnN0IG9yaWdpbmFsV3JpdGVGaWxlID0gdHNIb3N0LndyaXRlRmlsZS5iaW5kKHRzSG9zdCk7XG4gIHRzSG9zdC53cml0ZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLCBzb3VyY2VGaWxlcz86IHRzLlNvdXJjZUZpbGVbXSkgPT4ge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9IHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZS5yZXBsYWNlKC9cXFxcL2csICcvJyksIFtjb21waWxlck9wdHMucm9vdERpcl0pO1xuICAgICAgICBjb25zdCBleHBlY3RlZElkeCA9IHdyaXR0ZW5FeHBlY3RlZE91dHMuZmluZEluZGV4KG8gPT4gbyA9PT0gcmVsYXRpdmUpO1xuICAgICAgICBpZiAoZXhwZWN0ZWRJZHggPj0gMCkge1xuICAgICAgICAgIHdyaXR0ZW5FeHBlY3RlZE91dHMuc3BsaWNlKGV4cGVjdGVkSWR4LCAxKTtcbiAgICAgICAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgY29udGVudCwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QgPSBPYmplY3QuY3JlYXRlKHRzSG9zdCk7XG4gIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIoXG4gICAgICBtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcsXG4gICAgICBjb21waWxlck9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyk6IHRzLlJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyB7XG4gICAgcmV0dXJuIHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICBtb2R1bGVOYW1lLCBjb250YWluaW5nRmlsZSwgY29tcGlsZXJPcHRpb25zLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0KTtcbiAgfVxuXG4gIGNvbnN0IGJhemVsSG9zdCA9IG5ldyBDb21waWxlckhvc3QoXG4gICAgICBmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlciwgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKTtcblxuICAvLyBBbHNvIG5lZWQgdG8gZGlzYWJsZSBkZWNvcmF0b3IgZG93bmxldmVsaW5nIGluIHRoZSBCYXplbEhvc3QgaW4gSXZ5IG1vZGUuXG4gIGlmIChpc0luSXZ5TW9kZSkge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1EZWNvcmF0b3JzID0gZmFsc2U7XG4gIH1cblxuICAvLyBQcmV2ZW50IHRzaWNrbGUgYWRkaW5nIGFueSB0eXBlcyBhdCBhbGwgaWYgd2UgZG9uJ3Qgd2FudCBjbG9zdXJlIGNvbXBpbGVyIGFubm90YXRpb25zLlxuICBiYXplbEhvc3QudHJhbnNmb3JtVHlwZXNUb0Nsb3N1cmUgPSBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXI7XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID1cbiAgICAgICAgcGF0aC5wb3NpeC5qb2luKGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCBmbGF0TW9kdWxlT3V0UGF0aCkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcblxuICAgIGlmICh0YXJnZXRXb3Jrc3BhY2UgJiZcbiAgICAgICAgZmlsZU5hbWUgPT09XG4gICAgICAgICAgICBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg6IHN0cmluZykgPT4ge1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhpbXBvcnRlZEZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGltcG9ydGVkRmlsZVBhdGgpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGltcG9ydGVkRmlsZVBhdGgsIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBmdW5jdGlvbiBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9XG4gICAgICAgICAgICBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpLmltcG9ydEFzO1xuICAgICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICAgIHJldHVybiBtb2R1bGVOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLlVNRCB8fCBjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLkFNRCkgJiZcbiAgICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWUpIHtcbiAgICAgIHJldHVybiBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7IGZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRoIH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgaWYgKHJlc3VsdC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZXN1bHQuc3Vic3RyKE5PREVfTU9EVUxFUy5sZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUgKyAnLycgKyByZXN1bHQ7XG4gIH1cblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IG5nLlRzRW1pdENhbGxiYWNrID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QsIGJhemVsSG9zdCwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyLFxuICAgICAgICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlckRlY2xhcmF0aW9ucyxcbiAgICAgICAgICB9KTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtKTtcbiAgfVxuICBjb25zdCB7ZGlhZ25vc3RpY3MsIGVtaXRSZXN1bHQsIHByb2dyYW19ID0gbmcucGVyZm9ybUNvbXBpbGF0aW9uKHtcbiAgICByb290TmFtZXM6IGZpbGVzLFxuICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0cyxcbiAgICBob3N0OiBuZ0hvc3QsIGVtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s6IHRzaWNrbGUubWVyZ2VFbWl0UmVzdWx0cywgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoIWJhemVsT3B0cy5ub2RlTW9kdWxlc1ByZWZpeCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIG5vZGUgbW9kdWxlcywgdGhlbiBtZXRhZGF0YS5qc29uIHNob3VsZCBiZSBlbWl0dGVkIHNpbmNlXG4gICAgLy8gdGhlcmUgaXMgbm8gb3RoZXIgd2F5IHRvIG9idGFpbiB0aGUgaW5mb3JtYXRpb25cbiAgICBnZW5lcmF0ZU1ldGFkYXRhSnNvbihwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCBmaWxlcywgY29tcGlsZXJPcHRzLnJvb3REaXJzLCBiYXplbEJpbiwgdHNIb3N0KTtcbiAgfVxuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgd3JpdHRlbkV4cGVjdGVkT3V0cy5sZW5ndGg7IGkrKykge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKHdyaXR0ZW5FeHBlY3RlZE91dHNbaV0sICcnLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBtZXRhZGF0YS5qc29uIGZvciB0aGUgc3BlY2lmaWVkIGBmaWxlc2AuIEJ5IGRlZmF1bHQsIG1ldGFkYXRhLmpzb25cbiAqIGlzIG9ubHkgZ2VuZXJhdGVkIGJ5IHRoZSBjb21waWxlciBpZiAtLWZsYXRNb2R1bGVPdXRGaWxlIGlzIHNwZWNpZmllZC4gQnV0XG4gKiBpZiBjb21waWxlZCB1bmRlciBibGF6ZSwgd2Ugd2FudCB0aGUgbWV0YWRhdGEgdG8gYmUgZ2VuZXJhdGVkIGZvciBlYWNoXG4gKiBBbmd1bGFyIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVNZXRhZGF0YUpzb24oXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgZmlsZXM6IHN0cmluZ1tdLCByb290RGlyczogc3RyaW5nW10sIGJhemVsQmluOiBzdHJpbmcsXG4gICAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QpIHtcbiAgY29uc3QgY29sbGVjdG9yID0gbmV3IG5nLk1ldGFkYXRhQ29sbGVjdG9yKCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoc291cmNlRmlsZSkge1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBjb2xsZWN0b3IuZ2V0TWV0YWRhdGEoc291cmNlRmlsZSk7XG4gICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZSwgcm9vdERpcnMpO1xuICAgICAgICBjb25zdCBzaG9ydFBhdGggPSByZWxhdGl2ZS5yZXBsYWNlKEVYVCwgJy5tZXRhZGF0YS5qc29uJyk7XG4gICAgICAgIGNvbnN0IG91dEZpbGUgPSByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHNob3J0UGF0aCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSk7XG4gICAgICAgIHRzSG9zdC53cml0ZUZpbGUob3V0RmlsZSwgZGF0YSwgZmFsc2UsIHVuZGVmaW5lZCwgW10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIU5HQ19HRU5fRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiZcbiAgICAgIChiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICAgIG9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtKTogKG5nLkRpYWdub3N0aWMgfCB0cy5EaWFnbm9zdGljKVtdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuICBjb25zdCBkaWFnbm9zdGljczogKG5nLkRpYWdub3N0aWMgfCB0cy5EaWFnbm9zdGljKVtdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKGYgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gIH1cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBwcm9jZXNzLmV4aXRDb2RlID0gbWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpO1xufVxuIl19