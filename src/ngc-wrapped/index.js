/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
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
    var ng = require("@angular/compiler-cli");
    var typescript_1 = require("@bazel/typescript");
    var fs = require("fs");
    var path = require("path");
    var tsickle = require("tsickle/src/tsickle");
    var ts = require("typescript");
    var EXT = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
    var NGC_GEN_FILES = /^(.*?)\.(ngfactory|ngsummary|ngstyle|shim\.ngstyle)(.*)$/;
    // FIXME: we should be able to add the assets to the tsconfig so FileLoader
    // knows about them
    var NGC_ASSETS = /\.(css|html|ngsummary\.json)$/;
    var BAZEL_BIN = /\b(blaze|bazel)-out\b.*?\bbin\b/;
    // TODO(alexeagle): probably not needed, see
    // https://github.com/bazelbuild/rules_typescript/issues/28
    var ALLOW_NON_HERMETIC_READS = true;
    // Note: We compile the content of node_modules with plain ngc command line.
    var ALL_DEPS_COMPILED_WITH_BAZEL = false;
    var NODE_MODULES = 'node_modules/';
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
    var fileCache = new typescript_1.FileCache(typescript_1.debug);
    function runOneBuild(args, inputs) {
        if (args[0] === '-p')
            args.shift();
        // Strip leading at-signs, used to indicate a params file
        var project = args[0].replace(/^@+/, '');
        var _a = __read(typescript_1.parseTsconfig(project), 2), parsedOptions = _a[0], errors = _a[1];
        if (errors && errors.length) {
            console.error(ng.formatDiagnostics(errors));
            return false;
        }
        var tsOptions = parsedOptions.options, bazelOpts = parsedOptions.bazelOpts, files = parsedOptions.files, config = parsedOptions.config;
        var expectedOuts = config['angularCompilerOptions']['expectedOut'];
        var basePath = ng.calcProjectFileAndBasePath(project).basePath;
        var compilerOpts = ng.createNgCompilerOptions(basePath, config, tsOptions);
        var tsHost = ts.createCompilerHost(compilerOpts, true);
        var diagnostics = compile({
            allowNonHermeticReads: ALLOW_NON_HERMETIC_READS,
            allDepsCompiledWithBazel: ALL_DEPS_COMPILED_WITH_BAZEL,
            compilerOpts: compilerOpts,
            tsHost: tsHost,
            bazelOpts: bazelOpts,
            files: files,
            inputs: inputs,
            expectedOuts: expectedOuts
        }).diagnostics;
        if (diagnostics.length) {
            console.error(ng.formatDiagnostics(diagnostics));
        }
        return diagnostics.every(function (d) { return d.category !== ts.DiagnosticCategory.Error; });
    }
    exports.runOneBuild = runOneBuild;
    function relativeToRootDirs(filePath, rootDirs) {
        if (!filePath)
            return filePath;
        // NB: the rootDirs should have been sorted longest-first
        for (var i = 0; i < rootDirs.length; i++) {
            var dir = rootDirs[i];
            var rel = path.posix.relative(dir, filePath);
            if (rel.indexOf('.') != 0)
                return rel;
        }
        return filePath;
    }
    exports.relativeToRootDirs = relativeToRootDirs;
    function compile(_a) {
        var allowNonHermeticReads = _a.allowNonHermeticReads, _b = _a.allDepsCompiledWithBazel, allDepsCompiledWithBazel = _b === void 0 ? true : _b, compilerOpts = _a.compilerOpts, tsHost = _a.tsHost, bazelOpts = _a.bazelOpts, files = _a.files, inputs = _a.inputs, expectedOuts = _a.expectedOuts, gatherDiagnostics = _a.gatherDiagnostics;
        var fileLoader;
        if (bazelOpts.maxCacheSizeMb !== undefined) {
            var maxCacheSizeBytes = bazelOpts.maxCacheSizeMb * (1 << 20);
            fileCache.setMaxCacheSize(maxCacheSizeBytes);
        }
        else {
            fileCache.resetMaxCacheSize();
        }
        if (inputs) {
            fileLoader = new typescript_1.CachedFileLoader(fileCache, allowNonHermeticReads);
            // Resolve the inputs to absolute paths to match TypeScript internals
            var resolvedInputs = {};
            var inputKeys = Object.keys(inputs);
            for (var i = 0; i < inputKeys.length; i++) {
                var key = inputKeys[i];
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
        var isInIvyMode = compilerOpts.enableIvy === 'ngtsc' || compilerOpts.enableIvy === 'tsc';
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
        var bazelBin = compilerOpts.rootDirs.find(function (rootDir) { return BAZEL_BIN.test(rootDir); });
        if (!bazelBin) {
            throw new Error("Couldn't find bazel bin in the rootDirs: " + compilerOpts.rootDirs);
        }
        var writtenExpectedOuts = __spread(expectedOuts);
        var originalWriteFile = tsHost.writeFile.bind(tsHost);
        tsHost.writeFile =
            function (fileName, content, writeByteOrderMark, onError, sourceFiles) {
                var relative = relativeToRootDirs(fileName.replace(/\\/g, '/'), [compilerOpts.rootDir]);
                var expectedIdx = writtenExpectedOuts.findIndex(function (o) { return o === relative; });
                if (expectedIdx >= 0) {
                    writtenExpectedOuts.splice(expectedIdx, 1);
                    originalWriteFile(fileName, content, writeByteOrderMark, onError, sourceFiles);
                }
            };
        // Patch fileExists when resolving modules, so that CompilerHost can ask TypeScript to
        // resolve non-existing generated files that don't exist on disk, but are
        // synthetic and added to the `programWithStubs` based on real inputs.
        var generatedFileModuleResolverHost = Object.create(tsHost);
        generatedFileModuleResolverHost.fileExists = function (fileName) {
            var match = NGC_GEN_FILES.exec(fileName);
            if (match) {
                var _a = __read(match, 4), file = _a[1], suffix = _a[2], ext = _a[3];
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
        var bazelHost = new typescript_1.CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader, allowNonHermeticReads, generatedFileModuleResolver);
        // Also need to disable decorator downleveling in the BazelHost in Ivy mode.
        if (isInIvyMode) {
            bazelHost.transformDecorators = false;
        }
        // Prevent tsickle adding any types at all if we don't want closure compiler annotations.
        bazelHost.transformTypesToClosure = compilerOpts.annotateForClosureCompiler;
        var origBazelHostFileExist = bazelHost.fileExists;
        bazelHost.fileExists = function (fileName) {
            if (NGC_ASSETS.test(fileName)) {
                return tsHost.fileExists(fileName);
            }
            return origBazelHostFileExist.call(bazelHost, fileName);
        };
        var origBazelHostShouldNameModule = bazelHost.shouldNameModule.bind(bazelHost);
        bazelHost.shouldNameModule = function (fileName) {
            // The bundle index file is synthesized in bundle_index_host so it's not in the
            // compilationTargetSrc.
            // However we still want to give it an AMD module name for devmode.
            // We can't easily tell which file is the synthetic one, so we build up the path we expect
            // it to have and compare against that.
            if (fileName ===
                path.join(compilerOpts.baseUrl, bazelOpts.package, compilerOpts.flatModuleOutFile + '.ts'))
                return true;
            // Also handle the case the target is in an external repository.
            // Pull the workspace name from the target which is formatted as `@wksp//package:target`
            // if it the target is from an external workspace. If the target is from the local
            // workspace then it will be formatted as `//package:target`.
            var targetWorkspace = bazelOpts.target.split('/')[0].replace(/^@/, '');
            if (targetWorkspace &&
                fileName ===
                    path.join(compilerOpts.baseUrl, 'external', targetWorkspace, bazelOpts.package, compilerOpts.flatModuleOutFile + '.ts'))
                return true;
            return origBazelHostShouldNameModule(fileName) || NGC_GEN_FILES.test(fileName);
        };
        var ngHost = ng.createCompilerHost({ options: compilerOpts, tsHost: bazelHost });
        var fileNameToModuleNameCache = new Map();
        ngHost.fileNameToModuleName = function (importedFilePath, containingFilePath) {
            // Memoize this lookup to avoid expensive re-parses of the same file
            // When run as a worker, the actual ts.SourceFile is cached
            // but when we don't run as a worker, there is no cache.
            // For one example target in g3, we saw a cache hit rate of 7590/7695
            if (fileNameToModuleNameCache.has(importedFilePath)) {
                return fileNameToModuleNameCache.get(importedFilePath);
            }
            var result = doFileNameToModuleName(importedFilePath);
            fileNameToModuleNameCache.set(importedFilePath, result);
            return result;
        };
        function doFileNameToModuleName(importedFilePath) {
            try {
                var sourceFile = ngHost.getSourceFile(importedFilePath, ts.ScriptTarget.Latest);
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
            var result = relativeToRootDirs(importedFilePath, compilerOpts.rootDirs).replace(EXT, '');
            if (result.startsWith(NODE_MODULES)) {
                return result.substr(NODE_MODULES.length);
            }
            return bazelOpts.workspaceName + '/' + result;
        }
        ngHost.toSummaryFileName = function (fileName, referringSrcFileName) { return path.posix.join(bazelOpts.workspaceName, relativeToRootDirs(fileName, compilerOpts.rootDirs).replace(EXT, '')); };
        if (allDepsCompiledWithBazel) {
            // Note: The default implementation would work as well,
            // but we can be faster as we know how `toSummaryFileName` works.
            // Note: We can't do this if some deps have been compiled with the command line,
            // as that has a different implementation of fromSummaryFileName / toSummaryFileName
            ngHost.fromSummaryFileName = function (fileName, referringLibFileName) {
                var workspaceRelative = fileName.split('/').splice(1).join('/');
                return typescript_1.resolveNormalizedPath(bazelBin, workspaceRelative) + '.d.ts';
            };
        }
        // Patch a property on the ngHost that allows the resourceNameToModuleName function to
        // report better errors.
        ngHost.reportMissingResource = function (resourceName) {
            console.error("\nAsset not found:\n  " + resourceName);
            console.error('Check that it\'s included in the `assets` attribute of the `ng_module` rule.\n');
        };
        var emitCallback = function (_a) {
            var program = _a.program, targetSourceFile = _a.targetSourceFile, writeFile = _a.writeFile, cancellationToken = _a.cancellationToken, emitOnlyDtsFiles = _a.emitOnlyDtsFiles, _b = _a.customTransformers, customTransformers = _b === void 0 ? {} : _b;
            return tsickle.emitWithTsickle(program, bazelHost, bazelHost, compilerOpts, targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, {
                beforeTs: customTransformers.before,
                afterTs: __spread((customTransformers.after || []), [
                    typescript_1.fixUmdModuleDeclarations(function (sf) { return bazelHost.amdModuleName(sf); }),
                ]),
            });
        };
        if (!gatherDiagnostics) {
            gatherDiagnostics = function (program) {
                return gatherDiagnosticsForInputsOnly(compilerOpts, bazelOpts, program);
            };
        }
        var _c = ng.performCompilation({
            rootNames: files,
            options: compilerOpts,
            host: ngHost, emitCallback: emitCallback,
            mergeEmitResultsCallback: tsickle.mergeEmitResults, gatherDiagnostics: gatherDiagnostics
        }), diagnostics = _c.diagnostics, emitResult = _c.emitResult, program = _c.program;
        var tsickleEmitResult = emitResult;
        var externs = '/** @externs */\n';
        if (!diagnostics.length) {
            if (bazelOpts.tsickleGenerateExterns) {
                externs += tsickle.getGeneratedExterns(tsickleEmitResult.externs);
            }
            if (bazelOpts.manifest) {
                var manifest = typescript_1.constructManifest(tsickleEmitResult.modulesManifest, bazelHost);
                fs.writeFileSync(bazelOpts.manifest, manifest);
            }
        }
        // If compilation fails unexpectedly, performCompilation returns no program.
        // Make sure not to crash but report the diagnostics.
        if (!program)
            return { program: program, diagnostics: diagnostics };
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
        for (var i = 0; i < writtenExpectedOuts.length; i++) {
            originalWriteFile(writtenExpectedOuts[i], '', false);
        }
        return { program: program, diagnostics: diagnostics };
    }
    exports.compile = compile;
    /**
     * Generate metadata.json for the specified `files`. By default, metadata.json
     * is only generated by the compiler if --flatModuleOutFile is specified. But
     * if compiled under blaze, we want the metadata to be generated for each
     * Angular component.
     */
    function generateMetadataJson(program, files, rootDirs, bazelBin, tsHost) {
        var collector = new ng.MetadataCollector();
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var sourceFile = program.getSourceFile(file);
            if (sourceFile) {
                var metadata = collector.getMetadata(sourceFile);
                if (metadata) {
                    var relative = relativeToRootDirs(file, rootDirs);
                    var shortPath = relative.replace(EXT, '.metadata.json');
                    var outFile = typescript_1.resolveNormalizedPath(bazelBin, shortPath);
                    var data = JSON.stringify(metadata);
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
        var tsProgram = ngProgram.getTsProgram();
        var diagnostics = [];
        // These checks mirror ts.getPreEmitDiagnostics, with the important
        // exception of avoiding b/30708240, which is that if you call
        // program.getDeclarationDiagnostics() it somehow corrupts the emit.
        diagnostics.push.apply(diagnostics, __spread(tsProgram.getOptionsDiagnostics()));
        diagnostics.push.apply(diagnostics, __spread(tsProgram.getGlobalDiagnostics()));
        var programFiles = tsProgram.getSourceFiles().filter(function (f) { return isCompilationTarget(bazelOpts, f); });
        for (var i = 0; i < programFiles.length; i++) {
            var sf = programFiles[i];
            // Note: We only get the diagnostics for individual files
            // to e.g. not check libraries.
            diagnostics.push.apply(diagnostics, __spread(tsProgram.getSyntacticDiagnostics(sf)));
            diagnostics.push.apply(diagnostics, __spread(tsProgram.getSemanticDiagnostics(sf)));
        }
        if (!diagnostics.length) {
            // only gather the angular diagnostics if we have no diagnostics
            // in any other files.
            diagnostics.push.apply(diagnostics, __spread(ngProgram.getNgStructuralDiagnostics()));
            diagnostics.push.apply(diagnostics, __spread(ngProgram.getNgSemanticDiagnostics()));
        }
        return diagnostics;
    }
    if (require.main === module) {
        process.exitCode = main(process.argv.slice(2));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUVILDBDQUE0QztJQUM1QyxnREFBZ1A7SUFDaFAsdUJBQXlCO0lBQ3pCLDJCQUE2QjtJQUM3Qiw2Q0FBbUM7SUFDbkMsK0JBQWlDO0lBRWpDLElBQU0sR0FBRyxHQUFHLGtDQUFrQyxDQUFDO0lBQy9DLElBQU0sYUFBYSxHQUFHLDBEQUEwRCxDQUFDO0lBQ2pGLDJFQUEyRTtJQUMzRSxtQkFBbUI7SUFDbkIsSUFBTSxVQUFVLEdBQUcsK0JBQStCLENBQUM7SUFFbkQsSUFBTSxTQUFTLEdBQUcsaUNBQWlDLENBQUM7SUFFcEQsNENBQTRDO0lBQzVDLDJEQUEyRDtJQUMzRCxJQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQztJQUN0Qyw0RUFBNEU7SUFDNUUsSUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7SUFFM0MsSUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0lBRXJDLFNBQWdCLElBQUksQ0FBQyxJQUFJO1FBQ3ZCLElBQUksd0JBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNyQiwwQkFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQzVCO2FBQU07WUFDTCxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbEM7UUFDRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFQRCxvQkFPQztJQUVELHVEQUF1RDtJQUN2RCxJQUFNLFNBQVMsR0FBRyxJQUFJLHNCQUFTLENBQWdCLGtCQUFLLENBQUMsQ0FBQztJQUV0RCxTQUFnQixXQUFXLENBQUMsSUFBYyxFQUFFLE1BQWlDO1FBQzNF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dEIsV0FBVyxDQUFDLElBQUksT0FBaEIsV0FBVyxXQUFTLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxHQUFFO1lBQzVELFdBQVcsQ0FBQyxJQUFJLE9BQWhCLFdBQVcsV0FBUyxTQUFTLENBQUMsd0JBQXdCLEVBQUUsR0FBRTtTQUMzRDtRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO1FBQzNCLE9BQU8sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDaEQiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQge0JhemVsT3B0aW9ucywgQ2FjaGVkRmlsZUxvYWRlciwgQ29tcGlsZXJIb3N0LCBGaWxlQ2FjaGUsIEZpbGVMb2FkZXIsIFVuY2FjaGVkRmlsZUxvYWRlciwgY29uc3RydWN0TWFuaWZlc3QsIGRlYnVnLCBmaXhVbWRNb2R1bGVEZWNsYXJhdGlvbnMsIHBhcnNlVHNjb25maWcsIHJlc29sdmVOb3JtYWxpemVkUGF0aCwgcnVuQXNXb3JrZXIsIHJ1bldvcmtlckxvb3B9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBUT0RPKGFsZXhlYWdsZSk6IHByb2JhYmx5IG5vdCBuZWVkZWQsIHNlZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2JhemVsYnVpbGQvcnVsZXNfdHlwZXNjcmlwdC9pc3N1ZXMvMjhcbmNvbnN0IEFMTE9XX05PTl9IRVJNRVRJQ19SRUFEUyA9IHRydWU7XG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5PbmVCdWlsZChhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogYm9vbGVhbiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSBhcmdzLnNoaWZ0KCk7XG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB7b3B0aW9uczogdHNPcHRpb25zLCBiYXplbE9wdHMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3QgZXhwZWN0ZWRPdXRzID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ11bJ2V4cGVjdGVkT3V0J107XG5cbiAgY29uc3Qge2Jhc2VQYXRofSA9IG5nLmNhbGNQcm9qZWN0RmlsZUFuZEJhc2VQYXRoKHByb2plY3QpO1xuICBjb25zdCBjb21waWxlck9wdHMgPSBuZy5jcmVhdGVOZ0NvbXBpbGVyT3B0aW9ucyhiYXNlUGF0aCwgY29uZmlnLCB0c09wdGlvbnMpO1xuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbG93Tm9uSGVybWV0aWNSZWFkczogQUxMT1dfTk9OX0hFUk1FVElDX1JFQURTLFxuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgdHNIb3N0LFxuICAgIGJhemVsT3B0cyxcbiAgICBmaWxlcyxcbiAgICBpbnB1dHMsXG4gICAgZXhwZWN0ZWRPdXRzXG4gIH0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcykpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcy5ldmVyeShkID0+IGQuY2F0ZWdvcnkgIT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT0gMCkgcmV0dXJuIHJlbDtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKHthbGxvd05vbkhlcm1ldGljUmVhZHMsIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsIGNvbXBpbGVyT3B0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICB0c0hvc3QsIGJhemVsT3B0cywgZmlsZXMsIGlucHV0cywgZXhwZWN0ZWRPdXRzLCBnYXRoZXJEaWFnbm9zdGljc306IHtcbiAgYWxsb3dOb25IZXJtZXRpY1JlYWRzOiBib29sZWFuLFxuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuLFxuICBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gIGZpbGVzOiBzdHJpbmdbXSxcbiAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXSwgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogbmcuUHJvZ3JhbSkgPT4gbmcuRGlhZ25vc3RpY3Ncbn0pOiB7ZGlhZ25vc3RpY3M6IG5nLkRpYWdub3N0aWNzLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfSB7XG4gIGxldCBmaWxlTG9hZGVyOiBGaWxlTG9hZGVyO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgQ2FjaGVkRmlsZUxvYWRlcihmaWxlQ2FjaGUsIGFsbG93Tm9uSGVybWV0aWNSZWFkcyk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHM6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzW3Jlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpXSA9IGlucHV0c1trZXldO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlKSB7XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gdHJ1ZTtcbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGlvbnNBcyA9ICdzdGF0aWMgZmllbGRzJztcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gY29tcGlsZXJPcHRzLmVuYWJsZUl2eSA9PT0gJ25ndHNjJyB8fCBjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJztcblxuICAvLyBEaXNhYmxlIGRvd25sZXZlbGluZyBhbmQgQ2xvc3VyZSBhbm5vdGF0aW9uIGlmIGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAvLyBJbiBwYXNzLXRocm91Z2ggbW9kZSBmb3IgVHlwZVNjcmlwdCwgd2Ugd2FudCB0byB0dXJuIG9mZiBkZWNvcmF0b3IgdHJhbnNwaWxhdGlvbiBlbnRpcmVseS5cbiAgICAvLyBUaGlzIGNhdXNlcyBuZ2MgdG8gYmUgaGF2ZSBleGFjdGx5IGxpa2UgdHNjLlxuICAgIGlmIChjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJykge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0aW9uc0FzID0gJ2RlY29yYXRvcnMnO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IHdyaXR0ZW5FeHBlY3RlZE91dHMgPSBbLi4uZXhwZWN0ZWRPdXRzXTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUucmVwbGFjZSgvXFxcXC9nLCAnLycpLCBbY29tcGlsZXJPcHRzLnJvb3REaXJdKTtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRJZHggPSB3cml0dGVuRXhwZWN0ZWRPdXRzLmZpbmRJbmRleChvID0+IG8gPT09IHJlbGF0aXZlKTtcbiAgICAgICAgaWYgKGV4cGVjdGVkSWR4ID49IDApIHtcbiAgICAgICAgICB3cml0dGVuRXhwZWN0ZWRPdXRzLnNwbGljZShleHBlY3RlZElkeCwgMSk7XG4gICAgICAgICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gIC8vIFBhdGNoIGZpbGVFeGlzdHMgd2hlbiByZXNvbHZpbmcgbW9kdWxlcywgc28gdGhhdCBDb21waWxlckhvc3QgY2FuIGFzayBUeXBlU2NyaXB0IHRvXG4gIC8vIHJlc29sdmUgbm9uLWV4aXN0aW5nIGdlbmVyYXRlZCBmaWxlcyB0aGF0IGRvbid0IGV4aXN0IG9uIGRpc2ssIGJ1dCBhcmVcbiAgLy8gc3ludGhldGljIGFuZCBhZGRlZCB0byB0aGUgYHByb2dyYW1XaXRoU3R1YnNgIGJhc2VkIG9uIHJlYWwgaW5wdXRzLlxuICBjb25zdCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0ID0gT2JqZWN0LmNyZWF0ZSh0c0hvc3QpO1xuICBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gTkdDX0dFTl9GSUxFUy5leGVjKGZpbGVOYW1lKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFssIGZpbGUsIHN1ZmZpeCwgZXh0XSA9IG1hdGNoO1xuICAgICAgLy8gUGVyZm9ybWFuY2U6IHNraXAgbG9va2luZyBmb3IgZmlsZXMgb3RoZXIgdGhhbiAuZC50cyBvciAudHNcbiAgICAgIGlmIChleHQgIT09ICcudHMnICYmIGV4dCAhPT0gJy5kLnRzJykgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1ZmZpeC5pbmRleE9mKCduZ3N0eWxlJykgPj0gMCkge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uY3NzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmQudHMgb3IgZm9vLnRzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlICsgKGV4dCB8fCAnJyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKFxuICAgICAgbW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZTogc3RyaW5nLFxuICAgICAgY29tcGlsZXJPcHRpb25zOiB0cy5Db21waWxlck9wdGlvbnMpOiB0cy5SZXNvbHZlZE1vZHVsZVdpdGhGYWlsZWRMb29rdXBMb2NhdGlvbnMge1xuICAgIHJldHVybiB0cy5yZXNvbHZlTW9kdWxlTmFtZShcbiAgICAgICAgbW9kdWxlTmFtZSwgY29udGFpbmluZ0ZpbGUsIGNvbXBpbGVyT3B0aW9ucywgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCk7XG4gIH1cblxuICBjb25zdCBiYXplbEhvc3QgPSBuZXcgQ29tcGlsZXJIb3N0KFxuICAgICAgZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIsIGFsbG93Tm9uSGVybWV0aWNSZWFkcyxcbiAgICAgIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcik7XG5cbiAgLy8gQWxzbyBuZWVkIHRvIGRpc2FibGUgZGVjb3JhdG9yIGRvd25sZXZlbGluZyBpbiB0aGUgQmF6ZWxIb3N0IGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuICB9XG5cbiAgLy8gUHJldmVudCB0c2lja2xlIGFkZGluZyBhbnkgdHlwZXMgYXQgYWxsIGlmIHdlIGRvbid0IHdhbnQgY2xvc3VyZSBjb21waWxlciBhbm5vdGF0aW9ucy5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlID0gY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyO1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0ID0gYmF6ZWxIb3N0LmZpbGVFeGlzdHM7XG4gIGJhemVsSG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoTkdDX0FTU0VUUy50ZXN0KGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RGaWxlRXhpc3QuY2FsbChiYXplbEhvc3QsIGZpbGVOYW1lKTtcbiAgfTtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUgPSBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZS5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT1cbiAgICAgICAgcGF0aC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCBiYXplbE9wdHMucGFja2FnZSwgY29tcGlsZXJPcHRzLmZsYXRNb2R1bGVPdXRGaWxlICsgJy50cycpKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcbiAgICBpZiAodGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICAgIGZpbGVOYW1lID09PVxuICAgICAgICAgICAgcGF0aC5qb2luKFxuICAgICAgICAgICAgICAgIGNvbXBpbGVyT3B0cy5iYXNlVXJsLCAnZXh0ZXJuYWwnLCB0YXJnZXRXb3Jrc3BhY2UsIGJhemVsT3B0cy5wYWNrYWdlLFxuICAgICAgICAgICAgICAgIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnKSlcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSkgfHwgTkdDX0dFTl9GSUxFUy50ZXN0KGZpbGVOYW1lKTtcbiAgfTtcblxuICBjb25zdCBuZ0hvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnM6IGNvbXBpbGVyT3B0cywgdHNIb3N0OiBiYXplbEhvc3R9KTtcbiAgY29uc3QgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIG5nSG9zdC5maWxlTmFtZVRvTW9kdWxlTmFtZSA9IChpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgLy8gTWVtb2l6ZSB0aGlzIGxvb2t1cCB0byBhdm9pZCBleHBlbnNpdmUgcmUtcGFyc2VzIG9mIHRoZSBzYW1lIGZpbGVcbiAgICAvLyBXaGVuIHJ1biBhcyBhIHdvcmtlciwgdGhlIGFjdHVhbCB0cy5Tb3VyY2VGaWxlIGlzIGNhY2hlZFxuICAgIC8vIGJ1dCB3aGVuIHdlIGRvbid0IHJ1biBhcyBhIHdvcmtlciwgdGhlcmUgaXMgbm8gY2FjaGUuXG4gICAgLy8gRm9yIG9uZSBleGFtcGxlIHRhcmdldCBpbiBnMywgd2Ugc2F3IGEgY2FjaGUgaGl0IHJhdGUgb2YgNzU5MC83Njk1XG4gICAgaWYgKGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuaGFzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5nZXQoaW1wb3J0ZWRGaWxlUGF0aCk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCk7XG4gICAgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5zZXQoaW1wb3J0ZWRGaWxlUGF0aCwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IG5nSG9zdC5nZXRTb3VyY2VGaWxlKGltcG9ydGVkRmlsZVBhdGgsIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QpO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgJiYgc291cmNlRmlsZS5tb2R1bGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlLm1vZHVsZU5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIHBhcnNlIGVycm9yLiBJZ25vcmUgdGhpcyBjYXNlIGFuZCBjb250aW51ZSBvbnRvIHRoZVxuICAgICAgLy8gb3RoZXIgbWV0aG9kcyBvZiByZXNvbHZpbmcgdGhlIG1vZHVsZSBiZWxvdy5cbiAgICB9XG4gICAgaWYgKChjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLlVNRCB8fCBjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLkFNRCkgJiZcbiAgICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWUpIHtcbiAgICAgIHJldHVybiBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7IGZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRoIH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgaWYgKHJlc3VsdC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZXN1bHQuc3Vic3RyKE5PREVfTU9EVUxFUy5sZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUgKyAnLycgKyByZXN1bHQ7XG4gIH1cblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IG5nLlRzRW1pdENhbGxiYWNrID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QsIGJhemVsSG9zdCwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogW1xuICAgICAgICAgICAgICAuLi4oY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyIHx8IFtdKSxcbiAgICAgICAgICAgICAgZml4VW1kTW9kdWxlRGVjbGFyYXRpb25zKChzZjogdHMuU291cmNlRmlsZSkgPT4gYmF6ZWxIb3N0LmFtZE1vZHVsZU5hbWUoc2YpKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSk7XG5cbiAgaWYgKCFnYXRoZXJEaWFnbm9zdGljcykge1xuICAgIGdhdGhlckRpYWdub3N0aWNzID0gKHByb2dyYW0pID0+XG4gICAgICAgIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShjb21waWxlck9wdHMsIGJhemVsT3B0cywgcHJvZ3JhbSk7XG4gIH1cbiAgY29uc3Qge2RpYWdub3N0aWNzLCBlbWl0UmVzdWx0LCBwcm9ncmFtfSA9IG5nLnBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgcm9vdE5hbWVzOiBmaWxlcyxcbiAgICBvcHRpb25zOiBjb21waWxlck9wdHMsXG4gICAgaG9zdDogbmdIb3N0LCBlbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrOiB0c2lja2xlLm1lcmdlRW1pdFJlc3VsdHMsIGdhdGhlckRpYWdub3N0aWNzXG4gIH0pO1xuICBjb25zdCB0c2lja2xlRW1pdFJlc3VsdCA9IGVtaXRSZXN1bHQgYXMgdHNpY2tsZS5FbWl0UmVzdWx0O1xuICBsZXQgZXh0ZXJucyA9ICcvKiogQGV4dGVybnMgKi9cXG4nO1xuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGlmIChiYXplbE9wdHMudHNpY2tsZUdlbmVyYXRlRXh0ZXJucykge1xuICAgICAgZXh0ZXJucyArPSB0c2lja2xlLmdldEdlbmVyYXRlZEV4dGVybnModHNpY2tsZUVtaXRSZXN1bHQuZXh0ZXJucyk7XG4gICAgfVxuICAgIGlmIChiYXplbE9wdHMubWFuaWZlc3QpIHtcbiAgICAgIGNvbnN0IG1hbmlmZXN0ID0gY29uc3RydWN0TWFuaWZlc3QodHNpY2tsZUVtaXRSZXN1bHQubW9kdWxlc01hbmlmZXN0LCBiYXplbEhvc3QpO1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMubWFuaWZlc3QsIG1hbmlmZXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBjb21waWxhdGlvbiBmYWlscyB1bmV4cGVjdGVkbHksIHBlcmZvcm1Db21waWxhdGlvbiByZXR1cm5zIG5vIHByb2dyYW0uXG4gIC8vIE1ha2Ugc3VyZSBub3QgdG8gY3Jhc2ggYnV0IHJlcG9ydCB0aGUgZGlhZ25vc3RpY3MuXG4gIGlmICghcHJvZ3JhbSkgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG5cbiAgaWYgKCFiYXplbE9wdHMubm9kZU1vZHVsZXNQcmVmaXgpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBub2RlIG1vZHVsZXMsIHRoZW4gbWV0YWRhdGEuanNvbiBzaG91bGQgYmUgZW1pdHRlZCBzaW5jZVxuICAgIC8vIHRoZXJlIGlzIG5vIG90aGVyIHdheSB0byBvYnRhaW4gdGhlIGluZm9ybWF0aW9uXG4gICAgZ2VuZXJhdGVNZXRhZGF0YUpzb24ocHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSwgZmlsZXMsIGNvbXBpbGVyT3B0cy5yb290RGlycywgYmF6ZWxCaW4sIHRzSG9zdCk7XG4gIH1cblxuICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCkge1xuICAgIC8vIE5vdGU6IHdoZW4gdHNpY2tsZUV4dGVybnNQYXRoIGlzIHByb3ZpZGVkLCB3ZSBhbHdheXMgd3JpdGUgYSBmaWxlIGFzIGFcbiAgICAvLyBtYXJrZXIgdGhhdCBjb21waWxhdGlvbiBzdWNjZWVkZWQsIGV2ZW4gaWYgaXQncyBlbXB0eSAoanVzdCBjb250YWluaW5nIGFuXG4gICAgLy8gQGV4dGVybnMpLlxuICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCwgZXh0ZXJucyk7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHdyaXR0ZW5FeHBlY3RlZE91dHMubGVuZ3RoOyBpKyspIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZSh3cml0dGVuRXhwZWN0ZWRPdXRzW2ldLCAnJywgZmFsc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG59XG5cbi8qKlxuICogR2VuZXJhdGUgbWV0YWRhdGEuanNvbiBmb3IgdGhlIHNwZWNpZmllZCBgZmlsZXNgLiBCeSBkZWZhdWx0LCBtZXRhZGF0YS5qc29uXG4gKiBpcyBvbmx5IGdlbmVyYXRlZCBieSB0aGUgY29tcGlsZXIgaWYgLS1mbGF0TW9kdWxlT3V0RmlsZSBpcyBzcGVjaWZpZWQuIEJ1dFxuICogaWYgY29tcGlsZWQgdW5kZXIgYmxhemUsIHdlIHdhbnQgdGhlIG1ldGFkYXRhIHRvIGJlIGdlbmVyYXRlZCBmb3IgZWFjaFxuICogQW5ndWxhciBjb21wb25lbnQuXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlTWV0YWRhdGFKc29uKFxuICAgIHByb2dyYW06IHRzLlByb2dyYW0sIGZpbGVzOiBzdHJpbmdbXSwgcm9vdERpcnM6IHN0cmluZ1tdLCBiYXplbEJpbjogc3RyaW5nLFxuICAgIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0KSB7XG4gIGNvbnN0IGNvbGxlY3RvciA9IG5ldyBuZy5NZXRhZGF0YUNvbGxlY3RvcigpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2ldO1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgaWYgKHNvdXJjZUZpbGUpIHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhID0gY29sbGVjdG9yLmdldE1ldGFkYXRhKHNvdXJjZUZpbGUpO1xuICAgICAgaWYgKG1ldGFkYXRhKSB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlID0gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGUsIHJvb3REaXJzKTtcbiAgICAgICAgY29uc3Qgc2hvcnRQYXRoID0gcmVsYXRpdmUucmVwbGFjZShFWFQsICcubWV0YWRhdGEuanNvbicpO1xuICAgICAgICBjb25zdCBvdXRGaWxlID0gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCBzaG9ydFBhdGgpO1xuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpO1xuICAgICAgICB0c0hvc3Qud3JpdGVGaWxlKG91dEZpbGUsIGRhdGEsIGZhbHNlLCB1bmRlZmluZWQsIFtdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuICFOR0NfR0VOX0ZJTEVTLnRlc3Qoc2YuZmlsZU5hbWUpICYmXG4gICAgICAoYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluZGV4T2Yoc2YuZmlsZU5hbWUpICE9PSAtMSk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgICBvcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICAgIG5nUHJvZ3JhbTogbmcuUHJvZ3JhbSk6IChuZy5EaWFnbm9zdGljIHwgdHMuRGlhZ25vc3RpYylbXSB7XG4gIGNvbnN0IHRzUHJvZ3JhbSA9IG5nUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgY29uc3QgZGlhZ25vc3RpY3M6IChuZy5EaWFnbm9zdGljIHwgdHMuRGlhZ25vc3RpYylbXSA9IFtdO1xuICAvLyBUaGVzZSBjaGVja3MgbWlycm9yIHRzLmdldFByZUVtaXREaWFnbm9zdGljcywgd2l0aCB0aGUgaW1wb3J0YW50XG4gIC8vIGV4Y2VwdGlvbiBvZiBhdm9pZGluZyBiLzMwNzA4MjQwLCB3aGljaCBpcyB0aGF0IGlmIHlvdSBjYWxsXG4gIC8vIHByb2dyYW0uZ2V0RGVjbGFyYXRpb25EaWFnbm9zdGljcygpIGl0IHNvbWVob3cgY29ycnVwdHMgdGhlIGVtaXQuXG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpKTtcbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKSk7XG4gIGNvbnN0IHByb2dyYW1GaWxlcyA9IHRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihmID0+IGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzLCBmKSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvZ3JhbUZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgc2YgPSBwcm9ncmFtRmlsZXNbaV07XG4gICAgLy8gTm90ZTogV2Ugb25seSBnZXQgdGhlIGRpYWdub3N0aWNzIGZvciBpbmRpdmlkdWFsIGZpbGVzXG4gICAgLy8gdG8gZS5nLiBub3QgY2hlY2sgbGlicmFyaWVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNmKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzZikpO1xuICB9XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgLy8gb25seSBnYXRoZXIgdGhlIGFuZ3VsYXIgZGlhZ25vc3RpY3MgaWYgd2UgaGF2ZSBubyBkaWFnbm9zdGljc1xuICAgIC8vIGluIGFueSBvdGhlciBmaWxlcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgcHJvY2Vzcy5leGl0Q29kZSA9IG1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKTtcbn1cbiJdfQ==