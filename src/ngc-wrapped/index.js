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
    exports.compile = exports.relativeToRootDirs = exports.runOneBuild = exports.main = void 0;
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
        // These are options passed through from the `ng_module` rule which aren't supported
        // by the `@angular/compiler-cli` and are only intended for `ngc-wrapped`.
        const { expectedOut, _useManifestPathsAsModuleName } = config['angularCompilerOptions'];
        const { basePath } = ng.calcProjectFileAndBasePath(project);
        const compilerOpts = ng.createNgCompilerOptions(basePath, config, tsOptions);
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
        if (!bazelOpts.es5Mode) {
            compilerOpts.annotateForClosureCompiler = true;
            compilerOpts.annotationsAs = 'static fields';
        }
        // Detect from compilerOpts whether the entrypoint is being invoked in Ivy mode.
        const isInIvyMode = !!compilerOpts.enableIvy;
        // Disable downleveling and Closure annotation if in Ivy mode.
        if (isInIvyMode) {
            compilerOpts.annotationsAs = 'decorators';
        }
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
            // Also need to disable decorator downleveling in the BazelHost in Ivy mode.
            bazelHost.transformDecorators = false;
            const delegate = bazelHost.shouldSkipTsickleProcessing.bind(bazelHost);
            bazelHost.shouldSkipTsickleProcessing = (fileName) => {
                // The base implementation of shouldSkipTsickleProcessing checks whether `fileName` is part of
                // the original `srcs[]`. For Angular (Ivy) compilations, ngfactory/ngsummary files that are
                // shims for original .ts files in the program should be treated identically. Thus, strip the
                // '.ngfactory' or '.ngsummary' part of the filename away before calling the delegate.
                return delegate(fileName.replace(/\.(ngfactory|ngsummary)\.ts$/, '.ts'));
            };
        }
        // Prevent tsickle adding any types at all if we don't want closure compiler annotations.
        if (compilerOpts.annotateForClosureCompiler) {
            bazelHost.transformTypesToClosure = true;
            bazelHost.transformDecorators = true;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNENBQTRDO0lBQzVDLGtEQUFzTjtJQUN0Tix5QkFBeUI7SUFDekIsNkJBQTZCO0lBQzdCLCtDQUFtQztJQUNuQyxpQ0FBaUM7SUFFakMsTUFBTSxHQUFHLEdBQUcsa0NBQWtDLENBQUM7SUFDL0MsTUFBTSxhQUFhLEdBQUcsMERBQTBELENBQUM7SUFDakYsMkVBQTJFO0lBQzNFLG1CQUFtQjtJQUNuQixNQUFNLFVBQVUsR0FBRywrQkFBK0IsQ0FBQztJQUVuRCxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztJQUVwRCw0RUFBNEU7SUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7SUFFM0MsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0lBRXJDLFNBQWdCLElBQUksQ0FBQyxJQUFJO1FBQ3ZCLElBQUksd0JBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNyQiwwQkFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQzVCO2FBQU07WUFDTCxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbEM7UUFDRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFQRCxvQkFPQztJQUVELHVEQUF1RDtJQUN2RCxNQUFNLFNBQVMsR0FBRyxJQUFJLHNCQUFTLENBQWdCLGtCQUFLLENBQUMsQ0FBQztJQUV0RCxTQUFnQixXQUFXLENBQUMsSUFBYyxFQUFFLE1BQWlDO1FBQzNFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUk7WUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbkMseURBQXlE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RyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzVDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQix5REFBeUQ7WUFDekQsK0JBQStCO1lBQy9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDM0Q7UUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtZQUN2QixnRUFBZ0U7WUFDaEUsc0JBQXNCO1lBQ3RCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1lBQzVELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO1NBQzNEO1FBQ0QsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsT0FBTyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNoRCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7QmF6ZWxPcHRpb25zLCBDYWNoZWRGaWxlTG9hZGVyLCBDb21waWxlckhvc3QsIGNvbnN0cnVjdE1hbmlmZXN0LCBkZWJ1ZywgRmlsZUNhY2hlLCBGaWxlTG9hZGVyLCBwYXJzZVRzY29uZmlnLCByZXNvbHZlTm9ybWFsaXplZFBhdGgsIHJ1bkFzV29ya2VyLCBydW5Xb3JrZXJMb29wLCBVbmNhY2hlZEZpbGVMb2FkZXJ9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5PbmVCdWlsZChhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogYm9vbGVhbiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSBhcmdzLnNoaWZ0KCk7XG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB7b3B0aW9uczogdHNPcHRpb25zLCBiYXplbE9wdHMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3QgYW5ndWxhckNvbXBpbGVyT3B0aW9uczoge1trOiBzdHJpbmddOiB1bmtub3dufSA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddIHx8IHt9O1xuXG4gIC8vIEFsbG93IEJhemVsIHVzZXJzIHRvIGNvbnRyb2wgc29tZSBvZiB0aGUgYmF6ZWwgb3B0aW9ucy5cbiAgLy8gU2luY2UgVHlwZVNjcmlwdCdzIFwiZXh0ZW5kc1wiIG1lY2hhbmlzbSBhcHBsaWVzIG9ubHkgdG8gXCJjb21waWxlck9wdGlvbnNcIlxuICAvLyB3ZSBoYXZlIHRvIHJlcGVhdCBzb21lIG9mIHRoZWlyIGxvZ2ljIHRvIGdldCB0aGUgdXNlcidzIFwiYW5ndWxhckNvbXBpbGVyT3B0aW9uc1wiLlxuICBpZiAoY29uZmlnWydleHRlbmRzJ10pIHtcbiAgICAvLyBMb2FkIHRoZSB1c2VyJ3MgY29uZmlnIGZpbGVcbiAgICAvLyBOb3RlOiB0aGlzIGRvZXNuJ3QgaGFuZGxlIHJlY3Vyc2l2ZSBleHRlbmRzIHNvIG9ubHkgYSB1c2VyJ3MgdG9wIGxldmVsXG4gICAgLy8gYGFuZ3VsYXJDb21waWxlck9wdGlvbnNgIHdpbGwgYmUgY29uc2lkZXJlZC4gQXMgdGhpcyBjb2RlIGlzIGdvaW5nIHRvIGJlXG4gICAgLy8gcmVtb3ZlZCB3aXRoIEl2eSwgdGhlIGFkZGVkIGNvbXBsaWNhdGlvbiBvZiBoYW5kbGluZyByZWN1cnNpdmUgZXh0ZW5kc1xuICAgIC8vIGlzIGxpa2VseSBub3QgbmVlZGVkLlxuICAgIGxldCB1c2VyQ29uZmlnRmlsZSA9IHJlc29sdmVOb3JtYWxpemVkUGF0aChwYXRoLmRpcm5hbWUocHJvamVjdCksIGNvbmZpZ1snZXh0ZW5kcyddKTtcbiAgICBpZiAoIXVzZXJDb25maWdGaWxlLmVuZHNXaXRoKCcuanNvbicpKSB1c2VyQ29uZmlnRmlsZSArPSAnLmpzb24nO1xuICAgIGNvbnN0IHtjb25maWc6IHVzZXJDb25maWcsIGVycm9yfSA9IHRzLnJlYWRDb25maWdGaWxlKHVzZXJDb25maWdGaWxlLCB0cy5zeXMucmVhZEZpbGUpO1xuICAgIGlmIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhbZXJyb3JdKSk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQWxsIHVzZXIgYW5ndWxhckNvbXBpbGVyT3B0aW9ucyB2YWx1ZXMgdGhhdCBhIHVzZXIgaGFzIGNvbnRyb2xcbiAgICAvLyBvdmVyIHNob3VsZCBiZSBjb2xsZWN0ZWQgaGVyZVxuICAgIGlmICh1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMpIHtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2RpYWdub3N0aWNzJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2RpYWdub3N0aWNzJ10gfHwgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpYWdub3N0aWNzO1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1sndHJhY2UnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1sndHJhY2UnXSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMudHJhY2U7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snZGlzYWJsZUV4cHJlc3Npb25Mb3dlcmluZyddIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVFeHByZXNzaW9uTG93ZXJpbmc7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjayddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjayddIHx8XG4gICAgICAgICAgdXNlckNvbmZpZy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmRpc2FibGVUeXBlU2NyaXB0VmVyc2lvbkNoZWNrO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuT3V0TG9jYWxlJ10gPSBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuT3V0TG9jYWxlJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dExvY2FsZTtcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5PdXRGb3JtYXQnXSA9IGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5PdXRGb3JtYXQnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuT3V0Rm9ybWF0O1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bk91dEZpbGUnXSA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bk91dEZpbGUnXSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bk91dEZpbGU7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkZvcm1hdCddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5Gb3JtYXQnXSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRm9ybWF0O1xuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluTG9jYWxlJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkxvY2FsZSddIHx8IHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5pMThuSW5Mb2NhbGU7XG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5GaWxlJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5JbkZpbGUnXSB8fCB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluRmlsZTtcblxuICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucyddID1cbiAgICAgICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydpMThuSW5NaXNzaW5nVHJhbnNsYXRpb25zJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucztcbiAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ2kxOG5Vc2VFeHRlcm5hbElkcyddID0gYW5ndWxhckNvbXBpbGVyT3B0aW9uc1snaTE4blVzZUV4dGVybmFsSWRzJ10gfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuaTE4blVzZUV4dGVybmFsSWRzO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zWydwcmVzZXJ2ZVdoaXRlc3BhY2VzJ10gPVxuICAgICAgICAgIGFuZ3VsYXJDb21waWxlck9wdGlvbnNbJ3ByZXNlcnZlV2hpdGVzcGFjZXMnXSB8fFxuICAgICAgICAgIHVzZXJDb25maWcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2VzO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXJPcHRpb25zLmNyZWF0ZUV4dGVybmFsU3ltYm9sRmFjdG9yeVJlZXhwb3J0cyA9XG4gICAgICAgICAgYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5jcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMgfHxcbiAgICAgICAgICB1c2VyQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnMuY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddO1xuXG4gIGNvbnN0IHtiYXNlUGF0aH0gPSBuZy5jYWxjUHJvamVjdEZpbGVBbmRCYXNlUGF0aChwcm9qZWN0KTtcbiAgY29uc3QgY29tcGlsZXJPcHRzID0gbmcuY3JlYXRlTmdDb21waWxlck9wdGlvbnMoYmFzZVBhdGgsIGNvbmZpZywgdHNPcHRpb25zKTtcbiAgY29uc3QgdHNIb3N0ID0gdHMuY3JlYXRlQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0cywgdHJ1ZSk7XG4gIGNvbnN0IHtkaWFnbm9zdGljc30gPSBjb21waWxlKHtcbiAgICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw6IEFMTF9ERVBTX0NPTVBJTEVEX1dJVEhfQkFaRUwsXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogX3VzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gICAgZXhwZWN0ZWRPdXRzOiBleHBlY3RlZE91dCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgdHNIb3N0LFxuICAgIGJhemVsT3B0cyxcbiAgICBmaWxlcyxcbiAgICBpbnB1dHMsXG4gIH0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcykpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcy5ldmVyeShkID0+IGQuY2F0ZWdvcnkgIT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT0gMCkgcmV0dXJuIHJlbDtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKHtcbiAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsID0gdHJ1ZSxcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgY29tcGlsZXJPcHRzLFxuICB0c0hvc3QsXG4gIGJhemVsT3B0cyxcbiAgZmlsZXMsXG4gIGlucHV0cyxcbiAgZXhwZWN0ZWRPdXRzLFxuICBnYXRoZXJEaWFnbm9zdGljcyxcbiAgYmF6ZWxIb3N0XG59OiB7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbD86IGJvb2xlYW4sXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU/OiBib29sZWFuLCBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucywgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsXG4gIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbiAgICAgICAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgICAgIGZpbGVzOiBzdHJpbmdbXSxcbiAgICAgICAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXSxcbiAgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogbmcuUHJvZ3JhbSkgPT4gbmcuRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdD86IENvbXBpbGVySG9zdCxcbn0pOiB7ZGlhZ25vc3RpY3M6IG5nLkRpYWdub3N0aWNzLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfSB7XG4gIGxldCBmaWxlTG9hZGVyOiBGaWxlTG9hZGVyO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgQ2FjaGVkRmlsZUxvYWRlcihmaWxlQ2FjaGUpO1xuICAgIC8vIFJlc29sdmUgdGhlIGlucHV0cyB0byBhYnNvbHV0ZSBwYXRocyB0byBtYXRjaCBUeXBlU2NyaXB0IGludGVybmFsc1xuICAgIGNvbnN0IHJlc29sdmVkSW5wdXRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBjb25zdCBpbnB1dEtleXMgPSBPYmplY3Qua2V5cyhpbnB1dHMpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBrZXkgPSBpbnB1dEtleXNbaV07XG4gICAgICByZXNvbHZlZElucHV0cy5zZXQocmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGtleSksIGlucHV0c1trZXldKTtcbiAgICB9XG4gICAgZmlsZUNhY2hlLnVwZGF0ZUNhY2hlKHJlc29sdmVkSW5wdXRzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IFVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgaWYgKCFiYXplbE9wdHMuZXM1TW9kZSkge1xuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IHRydWU7XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRpb25zQXMgPSAnc3RhdGljIGZpZWxkcyc7XG4gIH1cblxuICAvLyBEZXRlY3QgZnJvbSBjb21waWxlck9wdHMgd2hldGhlciB0aGUgZW50cnlwb2ludCBpcyBiZWluZyBpbnZva2VkIGluIEl2eSBtb2RlLlxuICBjb25zdCBpc0luSXZ5TW9kZSA9ICEhY29tcGlsZXJPcHRzLmVuYWJsZUl2eTtcblxuICAvLyBEaXNhYmxlIGRvd25sZXZlbGluZyBhbmQgQ2xvc3VyZSBhbm5vdGF0aW9uIGlmIGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGlvbnNBcyA9ICdkZWNvcmF0b3JzJztcbiAgfVxuXG4gIGlmICghY29tcGlsZXJPcHRzLnJvb3REaXJzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdyb290RGlycyBpcyBub3Qgc2V0IScpO1xuICB9XG4gIGNvbnN0IGJhemVsQmluID0gY29tcGlsZXJPcHRzLnJvb3REaXJzLmZpbmQocm9vdERpciA9PiBCQVpFTF9CSU4udGVzdChyb290RGlyKSk7XG4gIGlmICghYmF6ZWxCaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgYmF6ZWwgYmluIGluIHRoZSByb290RGlyczogJHtjb21waWxlck9wdHMucm9vdERpcnN9YCk7XG4gIH1cblxuICBjb25zdCBleHBlY3RlZE91dHNTZXQgPSBuZXcgU2V0KGV4cGVjdGVkT3V0cy5tYXAocCA9PiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKHApKSk7XG5cbiAgY29uc3Qgb3JpZ2luYWxXcml0ZUZpbGUgPSB0c0hvc3Qud3JpdGVGaWxlLmJpbmQodHNIb3N0KTtcbiAgdHNIb3N0LndyaXRlRmlsZSA9XG4gICAgICAoZmlsZU5hbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCB3cml0ZUJ5dGVPcmRlck1hcms6IGJvb2xlYW4sXG4gICAgICAgb25FcnJvcj86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQsIHNvdXJjZUZpbGVzPzogdHMuU291cmNlRmlsZVtdKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlID1cbiAgICAgICAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVOYW1lKSwgW2NvbXBpbGVyT3B0cy5yb290RGlyXSk7XG4gICAgICAgIGlmIChleHBlY3RlZE91dHNTZXQuaGFzKHJlbGF0aXZlKSkge1xuICAgICAgICAgIGV4cGVjdGVkT3V0c1NldC5kZWxldGUocmVsYXRpdmUpO1xuICAgICAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3QgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCA9IE9iamVjdC5jcmVhdGUodHNIb3N0KTtcbiAgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBtYXRjaCA9IE5HQ19HRU5fRklMRVMuZXhlYyhmaWxlTmFtZSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbLCBmaWxlLCBzdWZmaXgsIGV4dF0gPSBtYXRjaDtcbiAgICAgIC8vIFBlcmZvcm1hbmNlOiBza2lwIGxvb2tpbmcgZm9yIGZpbGVzIG90aGVyIHRoYW4gLmQudHMgb3IgLnRzXG4gICAgICBpZiAoZXh0ICE9PSAnLnRzJyAmJiBleHQgIT09ICcuZC50cycpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmIChzdWZmaXguaW5kZXhPZignbmdzdHlsZScpID49IDApIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmNzcyBvbiBkaXNrXG4gICAgICAgIGZpbGVOYW1lID0gZmlsZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5kLnRzIG9yIGZvby50cyBvbiBkaXNrXG4gICAgICAgIGZpbGVOYW1lID0gZmlsZSArIChleHQgfHwgJycpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcihcbiAgICAgIG1vZHVsZU5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU6IHN0cmluZyxcbiAgICAgIGNvbXBpbGVyT3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zKTogdHMuUmVzb2x2ZWRNb2R1bGVXaXRoRmFpbGVkTG9va3VwTG9jYXRpb25zIHtcbiAgICByZXR1cm4gdHMucmVzb2x2ZU1vZHVsZU5hbWUoXG4gICAgICAgIG1vZHVsZU5hbWUsIGNvbnRhaW5pbmdGaWxlLCBjb21waWxlck9wdGlvbnMsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QpO1xuICB9XG5cbiAgaWYgKCFiYXplbEhvc3QpIHtcbiAgICBiYXplbEhvc3QgPSBuZXcgQ29tcGlsZXJIb3N0KFxuICAgICAgICBmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlciwgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKTtcbiAgfVxuXG4gIGlmIChpc0luSXZ5TW9kZSkge1xuICAgIC8vIEFsc28gbmVlZCB0byBkaXNhYmxlIGRlY29yYXRvciBkb3dubGV2ZWxpbmcgaW4gdGhlIEJhemVsSG9zdCBpbiBJdnkgbW9kZS5cbiAgICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuXG4gICAgY29uc3QgZGVsZWdhdGUgPSBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nLmJpbmQoYmF6ZWxIb3N0KTtcbiAgICBiYXplbEhvc3Quc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIC8vIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIHNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZyBjaGVja3Mgd2hldGhlciBgZmlsZU5hbWVgIGlzIHBhcnQgb2ZcbiAgICAgIC8vIHRoZSBvcmlnaW5hbCBgc3Jjc1tdYC4gRm9yIEFuZ3VsYXIgKEl2eSkgY29tcGlsYXRpb25zLCBuZ2ZhY3RvcnkvbmdzdW1tYXJ5IGZpbGVzIHRoYXQgYXJlXG4gICAgICAvLyBzaGltcyBmb3Igb3JpZ2luYWwgLnRzIGZpbGVzIGluIHRoZSBwcm9ncmFtIHNob3VsZCBiZSB0cmVhdGVkIGlkZW50aWNhbGx5LiBUaHVzLCBzdHJpcCB0aGVcbiAgICAgIC8vICcubmdmYWN0b3J5JyBvciAnLm5nc3VtbWFyeScgcGFydCBvZiB0aGUgZmlsZW5hbWUgYXdheSBiZWZvcmUgY2FsbGluZyB0aGUgZGVsZWdhdGUuXG4gICAgICByZXR1cm4gZGVsZWdhdGUoZmlsZU5hbWUucmVwbGFjZSgvXFwuKG5nZmFjdG9yeXxuZ3N1bW1hcnkpXFwudHMkLywgJy50cycpKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gUHJldmVudCB0c2lja2xlIGFkZGluZyBhbnkgdHlwZXMgYXQgYWxsIGlmIHdlIGRvbid0IHdhbnQgY2xvc3VyZSBjb21waWxlciBhbm5vdGF0aW9ucy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gICAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSB0cnVlO1xuICB9XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID1cbiAgICAgICAgcGF0aC5wb3NpeC5qb2luKGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCBmbGF0TW9kdWxlT3V0UGF0aCkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcblxuICAgIGlmICh0YXJnZXRXb3Jrc3BhY2UgJiZcbiAgICAgICAgZmlsZU5hbWUgPT09XG4gICAgICAgICAgICBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjYWNoZUtleSA9IGAke2ltcG9ydGVkRmlsZVBhdGh9OiR7Y29udGFpbmluZ0ZpbGVQYXRofWA7XG4gICAgLy8gTWVtb2l6ZSB0aGlzIGxvb2t1cCB0byBhdm9pZCBleHBlbnNpdmUgcmUtcGFyc2VzIG9mIHRoZSBzYW1lIGZpbGVcbiAgICAvLyBXaGVuIHJ1biBhcyBhIHdvcmtlciwgdGhlIGFjdHVhbCB0cy5Tb3VyY2VGaWxlIGlzIGNhY2hlZFxuICAgIC8vIGJ1dCB3aGVuIHdlIGRvbid0IHJ1biBhcyBhIHdvcmtlciwgdGhlcmUgaXMgbm8gY2FjaGUuXG4gICAgLy8gRm9yIG9uZSBleGFtcGxlIHRhcmdldCBpbiBnMywgd2Ugc2F3IGEgY2FjaGUgaGl0IHJhdGUgb2YgNzU5MC83Njk1XG4gICAgaWYgKGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoLCBjb250YWluaW5nRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGNhY2hlS2V5LCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVsYXRpdmVUYXJnZXRQYXRoID1cbiAgICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGltcG9ydGVkRmlsZVBhdGgsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKTtcbiAgICBjb25zdCBtYW5pZmVzdFRhcmdldFBhdGggPSBgJHtiYXplbE9wdHMud29ya3NwYWNlTmFtZX0vJHtyZWxhdGl2ZVRhcmdldFBhdGh9YDtcbiAgICBpZiAodXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG5cbiAgICAvLyBVbmxlc3MgbWFuaWZlc3QgcGF0aHMgYXJlIGV4cGxpY2l0bHkgZW5mb3JjZWQsIHdlIGluaXRpYWxseSBjaGVjayBpZiBhIG1vZHVsZSBuYW1lIGlzXG4gICAgLy8gc2V0IGZvciB0aGUgZ2l2ZW4gc291cmNlIGZpbGUuIFRoZSBjb21waWxlciBob3N0IGZyb20gYEBiYXplbC90eXBlc2NyaXB0YCBzZXRzIHNvdXJjZVxuICAgIC8vIGZpbGUgbW9kdWxlIG5hbWVzIGlmIHRoZSBjb21waWxhdGlvbiB0YXJnZXRzIGVpdGhlciBVTUQgb3IgQU1ELiBUbyBlbnN1cmUgdGhhdCB0aGUgQU1EXG4gICAgLy8gbW9kdWxlIG5hbWVzIG1hdGNoLCB3ZSBmaXJzdCBjb25zaWRlciB0aG9zZS5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IG5nSG9zdC5nZXRTb3VyY2VGaWxlKGltcG9ydGVkRmlsZVBhdGgsIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QpO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgJiYgc291cmNlRmlsZS5tb2R1bGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlLm1vZHVsZU5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIHBhcnNlIGVycm9yLiBJZ25vcmUgdGhpcyBjYXNlIGFuZCBjb250aW51ZSBvbnRvIHRoZVxuICAgICAgLy8gb3RoZXIgbWV0aG9kcyBvZiByZXNvbHZpbmcgdGhlIG1vZHVsZSBiZWxvdy5cbiAgICB9XG5cbiAgICAvLyBJdCBjYW4gaGFwcGVuIHRoYXQgdGhlIFZpZXdFbmdpbmUgY29tcGlsZXIgbmVlZHMgdG8gd3JpdGUgYW4gaW1wb3J0IGluIGEgZmFjdG9yeSBmaWxlLFxuICAgIC8vIGFuZCBpcyB1c2luZyBhbiBuZ3N1bW1hcnkgZmlsZSB0byBnZXQgdGhlIHN5bWJvbHMuXG4gICAgLy8gVGhlIG5nc3VtbWFyeSBjb21lcyBmcm9tIGFuIHVwc3RyZWFtIG5nX21vZHVsZSBydWxlLlxuICAgIC8vIFRoZSB1cHN0cmVhbSBydWxlIGJhc2VkIGl0cyBpbXBvcnRzIG9uIG5nc3VtbWFyeSBmaWxlIHdoaWNoIHdhcyBnZW5lcmF0ZWQgZnJvbSBhXG4gICAgLy8gbWV0YWRhdGEuanNvbiBmaWxlIHRoYXQgd2FzIHB1Ymxpc2hlZCB0byBucG0gaW4gYW4gQW5ndWxhciBsaWJyYXJ5LlxuICAgIC8vIEhvd2V2ZXIsIHRoZSBuZ3N1bW1hcnkgZG9lc24ndCBwcm9wYWdhdGUgdGhlICdpbXBvcnRBcycgZnJvbSB0aGUgb3JpZ2luYWwgbWV0YWRhdGEuanNvblxuICAgIC8vIHNvIHdlIHdvdWxkIG5vcm1hbGx5IG5vdCBiZSBhYmxlIHRvIHN1cHBseSB0aGUgY29ycmVjdCBtb2R1bGUgbmFtZSBmb3IgaXQuXG4gICAgLy8gRm9yIGV4YW1wbGUsIGlmIHRoZSByb290RGlyLXJlbGF0aXZlIGZpbGVQYXRoIGlzXG4gICAgLy8gIG5vZGVfbW9kdWxlcy9AYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyB3ZSB3b3VsZCBzdXBwbHkgYSBtb2R1bGUgbmFtZVxuICAgIC8vICBAYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyBidXQgdGhlcmUgaXMgbm8gSmF2YVNjcmlwdCBmaWxlIHRvIGxvYWQgYXQgdGhpcyBwYXRoLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy8yOTQ1NFxuICAgIGlmIChpbXBvcnRlZEZpbGVQYXRoLmluZGV4T2YoJ25vZGVfbW9kdWxlcycpID49IDApIHtcbiAgICAgIGNvbnN0IG1heWJlTWV0YWRhdGFGaWxlID0gaW1wb3J0ZWRGaWxlUGF0aC5yZXBsYWNlKEVYVCwgJycpICsgJy5tZXRhZGF0YS5qc29uJztcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKG1heWJlTWV0YWRhdGFGaWxlKSkge1xuICAgICAgICBjb25zdCBtb2R1bGVOYW1lID1cbiAgICAgICAgICAgIEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG1heWJlTWV0YWRhdGFGaWxlLCB7ZW5jb2Rpbmc6ICd1dGYtOCd9KSkuaW1wb3J0QXM7XG4gICAgICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG1vZHVsZU5hbWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgICBuZ0hvc3QuYW1kTW9kdWxlTmFtZSkge1xuICAgICAgcmV0dXJuIG5nSG9zdC5hbWRNb2R1bGVOYW1lKHtmaWxlTmFtZTogaW1wb3J0ZWRGaWxlUGF0aH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gQU1EIG1vZHVsZSBuYW1lIGhhcyBiZWVuIHNldCBmb3IgdGhlIHNvdXJjZSBmaWxlIGJ5IHRoZSBgQGJhemVsL3R5cGVzY3JpcHRgIGNvbXBpbGVyXG4gICAgLy8gaG9zdCwgYW5kIHRoZSB0YXJnZXQgZmlsZSBpcyBub3QgcGFydCBvZiBhIGZsYXQgbW9kdWxlIG5vZGUgbW9kdWxlIHBhY2thZ2UsIHdlIHVzZSB0aGVcbiAgICAvLyBmb2xsb3dpbmcgcnVsZXMgKGluIG9yZGVyKTpcbiAgICAvLyAgICAxLiBJZiB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGBub2RlX21vZHVsZXMvYCwgd2UgdXNlIHRoZSBwYWNrYWdlIG1vZHVsZSBuYW1lLlxuICAgIC8vICAgIDIuIElmIG5vIGNvbnRhaW5pbmcgZmlsZSBpcyBzcGVjaWZpZWQsIG9yIHRoZSB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGEgZGlmZmVyZW50XG4gICAgLy8gICAgICAgY29tcGlsYXRpb24gdW5pdCwgd2UgdXNlIGEgQmF6ZWwgbWFuaWZlc3QgcGF0aC4gUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBwb3NzaWJsZVxuICAgIC8vICAgICAgIHNpbmNlIHdlIGRvbid0IGhhdmUgYSBjb250YWluaW5nIGZpbGUsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgY291bGQgYmUgbG9jYXRlZCBpbiB0aGVcbiAgICAvLyAgICAgICBvdXRwdXQgZGlyZWN0b3J5LCBvciBpbiBhbiBleHRlcm5hbCBCYXplbCByZXBvc2l0b3J5LlxuICAgIC8vICAgIDMuIElmIGJvdGggcnVsZXMgYWJvdmUgZGlkbid0IG1hdGNoLCB3ZSBjb21wdXRlIGEgcmVsYXRpdmUgcGF0aCBiZXR3ZWVuIHRoZSBzb3VyY2UgZmlsZXNcbiAgICAvLyAgICAgICBzaW5jZSB0aGV5IGFyZSBwYXJ0IG9mIHRoZSBzYW1lIGNvbXBpbGF0aW9uIHVuaXQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IHdhbnQgdG8gYWx3YXlzIHVzZSAoMikgYmVjYXVzZSBpdCBjb3VsZCBtZWFuIHRoYXQgY29tcGlsYXRpb24gb3V0cHV0c1xuICAgIC8vIGFyZSBhbHdheXMgbGVha2luZyBCYXplbC1zcGVjaWZpYyBwYXRocywgYW5kIHRoZSBvdXRwdXQgaXMgbm90IHNlbGYtY29udGFpbmVkLiBUaGlzIGNvdWxkXG4gICAgLy8gYnJlYWsgYGVzbTIwMTVgIG9yIGBlc201YCBvdXRwdXQgZm9yIEFuZ3VsYXIgcGFja2FnZSByZWxlYXNlIG91dHB1dFxuICAgIC8vIE9taXQgdGhlIGBub2RlX21vZHVsZXNgIHByZWZpeCBpZiB0aGUgbW9kdWxlIG5hbWUgb2YgYW4gTlBNIHBhY2thZ2UgaXMgcmVxdWVzdGVkLlxuICAgIGlmIChyZWxhdGl2ZVRhcmdldFBhdGguc3RhcnRzV2l0aChOT0RFX01PRFVMRVMpKSB7XG4gICAgICByZXR1cm4gcmVsYXRpdmVUYXJnZXRQYXRoLnN1YnN0cihOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjb250YWluaW5nRmlsZVBhdGggPT0gbnVsbCB8fCAhYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluY2x1ZGVzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgICBjb25zdCBjb250YWluaW5nRmlsZURpciA9XG4gICAgICAgIHBhdGguZGlybmFtZShyZWxhdGl2ZVRvUm9vdERpcnMoY29udGFpbmluZ0ZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpKTtcbiAgICBjb25zdCByZWxhdGl2ZUltcG9ydFBhdGggPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGNvbnRhaW5pbmdGaWxlRGlyLCByZWxhdGl2ZVRhcmdldFBhdGgpO1xuICAgIHJldHVybiByZWxhdGl2ZUltcG9ydFBhdGguc3RhcnRzV2l0aCgnLicpID8gcmVsYXRpdmVJbXBvcnRQYXRoIDogYC4vJHtyZWxhdGl2ZUltcG9ydFBhdGh9YDtcbiAgfVxuXG4gIG5nSG9zdC50b1N1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSA9PiBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZSwgY29tcGlsZXJPcHRzLnJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpKTtcbiAgaWYgKGFsbERlcHNDb21waWxlZFdpdGhCYXplbCkge1xuICAgIC8vIE5vdGU6IFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCxcbiAgICAvLyBidXQgd2UgY2FuIGJlIGZhc3RlciBhcyB3ZSBrbm93IGhvdyBgdG9TdW1tYXJ5RmlsZU5hbWVgIHdvcmtzLlxuICAgIC8vIE5vdGU6IFdlIGNhbid0IGRvIHRoaXMgaWYgc29tZSBkZXBzIGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIHRoZSBjb21tYW5kIGxpbmUsXG4gICAgLy8gYXMgdGhhdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgZnJvbVN1bW1hcnlGaWxlTmFtZSAvIHRvU3VtbWFyeUZpbGVOYW1lXG4gICAgbmdIb3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBmaWxlTmFtZS5zcGxpdCgnLycpLnNwbGljZSgxKS5qb2luKCcvJyk7XG4gICAgICByZXR1cm4gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCB3b3Jrc3BhY2VSZWxhdGl2ZSkgKyAnLmQudHMnO1xuICAgIH07XG4gIH1cbiAgLy8gUGF0Y2ggYSBwcm9wZXJ0eSBvbiB0aGUgbmdIb3N0IHRoYXQgYWxsb3dzIHRoZSByZXNvdXJjZU5hbWVUb01vZHVsZU5hbWUgZnVuY3Rpb24gdG9cbiAgLy8gcmVwb3J0IGJldHRlciBlcnJvcnMuXG4gIChuZ0hvc3QgYXMgYW55KS5yZXBvcnRNaXNzaW5nUmVzb3VyY2UgPSAocmVzb3VyY2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGBcXG5Bc3NldCBub3QgZm91bmQ6XFxuICAke3Jlc291cmNlTmFtZX1gKTtcbiAgICBjb25zb2xlLmVycm9yKCdDaGVjayB0aGF0IGl0XFwncyBpbmNsdWRlZCBpbiB0aGUgYGFzc2V0c2AgYXR0cmlidXRlIG9mIHRoZSBgbmdfbW9kdWxlYCBydWxlLlxcbicpO1xuICB9O1xuXG4gIGNvbnN0IGVtaXRDYWxsYmFjazogbmcuVHNFbWl0Q2FsbGJhY2sgPSAoe1xuICAgIHByb2dyYW0sXG4gICAgdGFyZ2V0U291cmNlRmlsZSxcbiAgICB3cml0ZUZpbGUsXG4gICAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gICAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgfSkgPT5cbiAgICAgIHRzaWNrbGUuZW1pdFdpdGhUc2lja2xlKFxuICAgICAgICAgIHByb2dyYW0sIGJhemVsSG9zdCwgYmF6ZWxIb3N0LCBjb21waWxlck9wdHMsIHRhcmdldFNvdXJjZUZpbGUsIHdyaXRlRmlsZSxcbiAgICAgICAgICBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywge1xuICAgICAgICAgICAgYmVmb3JlVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5iZWZvcmUsXG4gICAgICAgICAgICBhZnRlclRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXIsXG4gICAgICAgICAgICBhZnRlckRlY2xhcmF0aW9uczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyRGVjbGFyYXRpb25zLFxuICAgICAgICAgIH0pO1xuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0pO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oe1xuICAgIHJvb3ROYW1lczogZmlsZXMsXG4gICAgb3B0aW9uczogY29tcGlsZXJPcHRzLFxuICAgIGhvc3Q6IG5nSG9zdCxcbiAgICBlbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrOiB0c2lja2xlLm1lcmdlRW1pdFJlc3VsdHMsXG4gICAgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoIWJhemVsT3B0cy5ub2RlTW9kdWxlc1ByZWZpeCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIG5vZGUgbW9kdWxlcywgdGhlbiBtZXRhZGF0YS5qc29uIHNob3VsZCBiZSBlbWl0dGVkIHNpbmNlXG4gICAgLy8gdGhlcmUgaXMgbm8gb3RoZXIgd2F5IHRvIG9idGFpbiB0aGUgaW5mb3JtYXRpb25cbiAgICBnZW5lcmF0ZU1ldGFkYXRhSnNvbihwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCBmaWxlcywgY29tcGlsZXJPcHRzLnJvb3REaXJzLCBiYXplbEJpbiwgdHNIb3N0KTtcbiAgfVxuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIC8vIFRoZXJlIG1pZ2h0IGJlIHNvbWUgZXhwZWN0ZWQgb3V0cHV0IGZpbGVzIHRoYXQgYXJlIG5vdCB3cml0dGVuIGJ5IHRoZVxuICAvLyBjb21waWxlci4gSW4gdGhpcyBjYXNlLCBqdXN0IHdyaXRlIGFuIGVtcHR5IGZpbGUuXG4gIGZvciAoY29uc3QgZmlsZU5hbWUgb2YgZXhwZWN0ZWRPdXRzU2V0KSB7XG4gICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsICcnLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBtZXRhZGF0YS5qc29uIGZvciB0aGUgc3BlY2lmaWVkIGBmaWxlc2AuIEJ5IGRlZmF1bHQsIG1ldGFkYXRhLmpzb25cbiAqIGlzIG9ubHkgZ2VuZXJhdGVkIGJ5IHRoZSBjb21waWxlciBpZiAtLWZsYXRNb2R1bGVPdXRGaWxlIGlzIHNwZWNpZmllZC4gQnV0XG4gKiBpZiBjb21waWxlZCB1bmRlciBibGF6ZSwgd2Ugd2FudCB0aGUgbWV0YWRhdGEgdG8gYmUgZ2VuZXJhdGVkIGZvciBlYWNoXG4gKiBBbmd1bGFyIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVNZXRhZGF0YUpzb24oXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgZmlsZXM6IHN0cmluZ1tdLCByb290RGlyczogc3RyaW5nW10sIGJhemVsQmluOiBzdHJpbmcsXG4gICAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QpIHtcbiAgY29uc3QgY29sbGVjdG9yID0gbmV3IG5nLk1ldGFkYXRhQ29sbGVjdG9yKCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoc291cmNlRmlsZSkge1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBjb2xsZWN0b3IuZ2V0TWV0YWRhdGEoc291cmNlRmlsZSk7XG4gICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZSwgcm9vdERpcnMpO1xuICAgICAgICBjb25zdCBzaG9ydFBhdGggPSByZWxhdGl2ZS5yZXBsYWNlKEVYVCwgJy5tZXRhZGF0YS5qc29uJyk7XG4gICAgICAgIGNvbnN0IG91dEZpbGUgPSByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHNob3J0UGF0aCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSk7XG4gICAgICAgIHRzSG9zdC53cml0ZUZpbGUob3V0RmlsZSwgZGF0YSwgZmFsc2UsIHVuZGVmaW5lZCwgW10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIU5HQ19HRU5fRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiZcbiAgICAgIChiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZpbGVQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICAgIG9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtKTogKG5nLkRpYWdub3N0aWN8dHMuRGlhZ25vc3RpYylbXSB7XG4gIGNvbnN0IHRzUHJvZ3JhbSA9IG5nUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IChuZy5EaWFnbm9zdGljfHRzLkRpYWdub3N0aWMpW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoZiA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgfVxuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIC8vIG9ubHkgZ2F0aGVyIHRoZSBhbmd1bGFyIGRpYWdub3N0aWNzIGlmIHdlIGhhdmUgbm8gZGlhZ25vc3RpY3NcbiAgICAvLyBpbiBhbnkgb3RoZXIgZmlsZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIHByb2Nlc3MuZXhpdENvZGUgPSBtYWluKHByb2Nlc3MuYXJndi5zbGljZSgyKSk7XG59XG4iXX0=