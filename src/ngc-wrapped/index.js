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
            // it to have
            // and compare against that.
            if (fileName ===
                path.join(compilerOpts.baseUrl, bazelOpts.package, compilerOpts.flatModuleOutFile + '.ts'))
                return true;
            // Also handle the case when angular is built from source as an external repository
            if (fileName ===
                path.join(compilerOpts.baseUrl, 'external/angular', bazelOpts.package, compilerOpts.flatModuleOutFile + '.ts'))
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
                afterTs: customTransformers.after,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUVILDBDQUE0QztJQUM1QyxnREFBc047SUFDdE4sdUJBQXlCO0lBQ3pCLDJCQUE2QjtJQUM3Qiw2Q0FBbUM7SUFDbkMsK0JBQWlDO0lBRWpDLElBQU0sR0FBRyxHQUFHLGtDQUFrQyxDQUFDO0lBQy9DLElBQU0sYUFBYSxHQUFHLDBEQUEwRCxDQUFDO0lBQ2pGLDJFQUEyRTtJQUMzRSxtQkFBbUI7SUFDbkIsSUFBTSxVQUFVLEdBQUcsK0JBQStCLENBQUM7SUFFbkQsSUFBTSxTQUFTLEdBQUcsaUNBQWlDLENBQUM7SUFFcEQsNENBQTRDO0lBQzVDLDJEQUEyRDtJQUMzRCxJQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQztJQUN0Qyw0RUFBNEU7SUFDNUUsSUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7SUFFM0MsSUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0lBRXJDLFNBQWdCLElBQUksQ0FBQyxJQUFJO1FBQ3ZCLElBQUksd0JBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNyQiwwQkFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQzVCO2FBQU07WUFDTCxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbEM7UUFDRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFQRCxvQkFPQztJQUVELHVEQUF1RDtJQUN2RCxJQUFNLFNBQVMsR0FBRyxJQUFJLHNCQUFTLENBQWdCLGtCQUFLLENBQUMsQ0FBQztJQUV0RCxTQUFnQixXQUFXLENBQUMsSUFBYyxFQUFFLE1BQWlDO1FBQzNF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LENBQUMsQ0FBQztLQUNoRCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7QmF6ZWxPcHRpb25zLCBDYWNoZWRGaWxlTG9hZGVyLCBDb21waWxlckhvc3QsIEZpbGVDYWNoZSwgRmlsZUxvYWRlciwgVW5jYWNoZWRGaWxlTG9hZGVyLCBjb25zdHJ1Y3RNYW5pZmVzdCwgZGVidWcsIHBhcnNlVHNjb25maWcsIHJlc29sdmVOb3JtYWxpemVkUGF0aCwgcnVuQXNXb3JrZXIsIHJ1bldvcmtlckxvb3B9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBUT0RPKGFsZXhlYWdsZSk6IHByb2JhYmx5IG5vdCBuZWVkZWQsIHNlZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2JhemVsYnVpbGQvcnVsZXNfdHlwZXNjcmlwdC9pc3N1ZXMvMjhcbmNvbnN0IEFMTE9XX05PTl9IRVJNRVRJQ19SRUFEUyA9IHRydWU7XG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5PbmVCdWlsZChhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogYm9vbGVhbiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSBhcmdzLnNoaWZ0KCk7XG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB7b3B0aW9uczogdHNPcHRpb25zLCBiYXplbE9wdHMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3QgZXhwZWN0ZWRPdXRzID0gY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ11bJ2V4cGVjdGVkT3V0J107XG5cbiAgY29uc3Qge2Jhc2VQYXRofSA9IG5nLmNhbGNQcm9qZWN0RmlsZUFuZEJhc2VQYXRoKHByb2plY3QpO1xuICBjb25zdCBjb21waWxlck9wdHMgPSBuZy5jcmVhdGVOZ0NvbXBpbGVyT3B0aW9ucyhiYXNlUGF0aCwgY29uZmlnLCB0c09wdGlvbnMpO1xuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbG93Tm9uSGVybWV0aWNSZWFkczogQUxMT1dfTk9OX0hFUk1FVElDX1JFQURTLFxuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICBjb21waWxlck9wdHMsXG4gICAgdHNIb3N0LFxuICAgIGJhemVsT3B0cyxcbiAgICBmaWxlcyxcbiAgICBpbnB1dHMsXG4gICAgZXhwZWN0ZWRPdXRzXG4gIH0pO1xuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhkaWFnbm9zdGljcykpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcy5ldmVyeShkID0+IGQuY2F0ZWdvcnkgIT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT0gMCkgcmV0dXJuIHJlbDtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlKHthbGxvd05vbkhlcm1ldGljUmVhZHMsIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsIGNvbXBpbGVyT3B0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICB0c0hvc3QsIGJhemVsT3B0cywgZmlsZXMsIGlucHV0cywgZXhwZWN0ZWRPdXRzLCBnYXRoZXJEaWFnbm9zdGljc306IHtcbiAgYWxsb3dOb25IZXJtZXRpY1JlYWRzOiBib29sZWFuLFxuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuLFxuICBjb21waWxlck9wdHM6IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbiAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gIGZpbGVzOiBzdHJpbmdbXSxcbiAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXSwgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogbmcuUHJvZ3JhbSkgPT4gbmcuRGlhZ25vc3RpY3Ncbn0pOiB7ZGlhZ25vc3RpY3M6IG5nLkRpYWdub3N0aWNzLCBwcm9ncmFtOiBuZy5Qcm9ncmFtfSB7XG4gIGxldCBmaWxlTG9hZGVyOiBGaWxlTG9hZGVyO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgQ2FjaGVkRmlsZUxvYWRlcihmaWxlQ2FjaGUsIGFsbG93Tm9uSGVybWV0aWNSZWFkcyk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHM6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzW3Jlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpXSA9IGlucHV0c1trZXldO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlKSB7XG4gICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gdHJ1ZTtcbiAgICBjb21waWxlck9wdHMuYW5ub3RhdGlvbnNBcyA9ICdzdGF0aWMgZmllbGRzJztcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gY29tcGlsZXJPcHRzLmVuYWJsZUl2eSA9PT0gJ25ndHNjJyB8fCBjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJztcblxuICAvLyBEaXNhYmxlIGRvd25sZXZlbGluZyBhbmQgQ2xvc3VyZSBhbm5vdGF0aW9uIGlmIGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAvLyBJbiBwYXNzLXRocm91Z2ggbW9kZSBmb3IgVHlwZVNjcmlwdCwgd2Ugd2FudCB0byB0dXJuIG9mZiBkZWNvcmF0b3IgdHJhbnNwaWxhdGlvbiBlbnRpcmVseS5cbiAgICAvLyBUaGlzIGNhdXNlcyBuZ2MgdG8gYmUgaGF2ZSBleGFjdGx5IGxpa2UgdHNjLlxuICAgIGlmIChjb21waWxlck9wdHMuZW5hYmxlSXZ5ID09PSAndHNjJykge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0aW9uc0FzID0gJ2RlY29yYXRvcnMnO1xuICB9XG5cbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IHdyaXR0ZW5FeHBlY3RlZE91dHMgPSBbLi4uZXhwZWN0ZWRPdXRzXTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUucmVwbGFjZSgvXFxcXC9nLCAnLycpLCBbY29tcGlsZXJPcHRzLnJvb3REaXJdKTtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRJZHggPSB3cml0dGVuRXhwZWN0ZWRPdXRzLmZpbmRJbmRleChvID0+IG8gPT09IHJlbGF0aXZlKTtcbiAgICAgICAgaWYgKGV4cGVjdGVkSWR4ID49IDApIHtcbiAgICAgICAgICB3cml0dGVuRXhwZWN0ZWRPdXRzLnNwbGljZShleHBlY3RlZElkeCwgMSk7XG4gICAgICAgICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gIC8vIFBhdGNoIGZpbGVFeGlzdHMgd2hlbiByZXNvbHZpbmcgbW9kdWxlcywgc28gdGhhdCBDb21waWxlckhvc3QgY2FuIGFzayBUeXBlU2NyaXB0IHRvXG4gIC8vIHJlc29sdmUgbm9uLWV4aXN0aW5nIGdlbmVyYXRlZCBmaWxlcyB0aGF0IGRvbid0IGV4aXN0IG9uIGRpc2ssIGJ1dCBhcmVcbiAgLy8gc3ludGhldGljIGFuZCBhZGRlZCB0byB0aGUgYHByb2dyYW1XaXRoU3R1YnNgIGJhc2VkIG9uIHJlYWwgaW5wdXRzLlxuICBjb25zdCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0ID0gT2JqZWN0LmNyZWF0ZSh0c0hvc3QpO1xuICBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gTkdDX0dFTl9GSUxFUy5leGVjKGZpbGVOYW1lKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFssIGZpbGUsIHN1ZmZpeCwgZXh0XSA9IG1hdGNoO1xuICAgICAgLy8gUGVyZm9ybWFuY2U6IHNraXAgbG9va2luZyBmb3IgZmlsZXMgb3RoZXIgdGhhbiAuZC50cyBvciAudHNcbiAgICAgIGlmIChleHQgIT09ICcudHMnICYmIGV4dCAhPT0gJy5kLnRzJykgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1ZmZpeC5pbmRleE9mKCduZ3N0eWxlJykgPj0gMCkge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uY3NzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmQudHMgb3IgZm9vLnRzIG9uIGRpc2tcbiAgICAgICAgZmlsZU5hbWUgPSBmaWxlICsgKGV4dCB8fCAnJyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKFxuICAgICAgbW9kdWxlTmFtZTogc3RyaW5nLCBjb250YWluaW5nRmlsZTogc3RyaW5nLFxuICAgICAgY29tcGlsZXJPcHRpb25zOiB0cy5Db21waWxlck9wdGlvbnMpOiB0cy5SZXNvbHZlZE1vZHVsZVdpdGhGYWlsZWRMb29rdXBMb2NhdGlvbnMge1xuICAgIHJldHVybiB0cy5yZXNvbHZlTW9kdWxlTmFtZShcbiAgICAgICAgbW9kdWxlTmFtZSwgY29udGFpbmluZ0ZpbGUsIGNvbXBpbGVyT3B0aW9ucywgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCk7XG4gIH1cblxuICBjb25zdCBiYXplbEhvc3QgPSBuZXcgQ29tcGlsZXJIb3N0KFxuICAgICAgZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIsIGFsbG93Tm9uSGVybWV0aWNSZWFkcyxcbiAgICAgIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcik7XG5cbiAgLy8gQWxzbyBuZWVkIHRvIGRpc2FibGUgZGVjb3JhdG9yIGRvd25sZXZlbGluZyBpbiB0aGUgQmF6ZWxIb3N0IGluIEl2eSBtb2RlLlxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuICB9XG5cbiAgLy8gUHJldmVudCB0c2lja2xlIGFkZGluZyBhbnkgdHlwZXMgYXQgYWxsIGlmIHdlIGRvbid0IHdhbnQgY2xvc3VyZSBjb21waWxlciBhbm5vdGF0aW9ucy5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlID0gY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyO1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0ID0gYmF6ZWxIb3N0LmZpbGVFeGlzdHM7XG4gIGJhemVsSG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoTkdDX0FTU0VUUy50ZXN0KGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RGaWxlRXhpc3QuY2FsbChiYXplbEhvc3QsIGZpbGVOYW1lKTtcbiAgfTtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUgPSBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZS5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmVcbiAgICAvLyBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PVxuICAgICAgICBwYXRoLmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsIGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJykpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICAvLyBBbHNvIGhhbmRsZSB0aGUgY2FzZSB3aGVuIGFuZ3VsYXIgaXMgYnVpbHQgZnJvbSBzb3VyY2UgYXMgYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeVxuICAgIGlmIChmaWxlTmFtZSA9PT1cbiAgICAgICAgcGF0aC5qb2luKFxuICAgICAgICAgICAgY29tcGlsZXJPcHRzLmJhc2VVcmwsICdleHRlcm5hbC9hbmd1bGFyJywgYmF6ZWxPcHRzLnBhY2thZ2UsXG4gICAgICAgICAgICBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJykpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg6IHN0cmluZykgPT4ge1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhpbXBvcnRlZEZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGltcG9ydGVkRmlsZVBhdGgpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGltcG9ydGVkRmlsZVBhdGgsIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBmdW5jdGlvbiBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuICAgIGlmICgoY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5VTUQgfHwgY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5BTUQpICYmXG4gICAgICAgIG5nSG9zdC5hbWRNb2R1bGVOYW1lKSB7XG4gICAgICByZXR1cm4gbmdIb3N0LmFtZE1vZHVsZU5hbWUoeyBmaWxlTmFtZTogaW1wb3J0ZWRGaWxlUGF0aCB9IGFzIHRzLlNvdXJjZUZpbGUpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSByZWxhdGl2ZVRvUm9vdERpcnMoaW1wb3J0ZWRGaWxlUGF0aCwgY29tcGlsZXJPcHRzLnJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpO1xuICAgIGlmIChyZXN1bHQuc3RhcnRzV2l0aChOT0RFX01PRFVMRVMpKSB7XG4gICAgICByZXR1cm4gcmVzdWx0LnN1YnN0cihOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lICsgJy8nICsgcmVzdWx0O1xuICB9XG5cbiAgbmdIb3N0LnRvU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpID0+IHBhdGgucG9zaXguam9pbihcbiAgICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLFxuICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVOYW1lLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJykpO1xuICBpZiAoYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsKSB7XG4gICAgLy8gTm90ZTogVGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gd291bGQgd29yayBhcyB3ZWxsLFxuICAgIC8vIGJ1dCB3ZSBjYW4gYmUgZmFzdGVyIGFzIHdlIGtub3cgaG93IGB0b1N1bW1hcnlGaWxlTmFtZWAgd29ya3MuXG4gICAgLy8gTm90ZTogV2UgY2FuJ3QgZG8gdGhpcyBpZiBzb21lIGRlcHMgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggdGhlIGNvbW1hbmQgbGluZSxcbiAgICAvLyBhcyB0aGF0IGhhcyBhIGRpZmZlcmVudCBpbXBsZW1lbnRhdGlvbiBvZiBmcm9tU3VtbWFyeUZpbGVOYW1lIC8gdG9TdW1tYXJ5RmlsZU5hbWVcbiAgICBuZ0hvc3QuZnJvbVN1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdMaWJGaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSZWxhdGl2ZSA9IGZpbGVOYW1lLnNwbGl0KCcvJykuc3BsaWNlKDEpLmpvaW4oJy8nKTtcbiAgICAgIHJldHVybiByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHdvcmtzcGFjZVJlbGF0aXZlKSArICcuZC50cyc7XG4gICAgfTtcbiAgfVxuICAvLyBQYXRjaCBhIHByb3BlcnR5IG9uIHRoZSBuZ0hvc3QgdGhhdCBhbGxvd3MgdGhlIHJlc291cmNlTmFtZVRvTW9kdWxlTmFtZSBmdW5jdGlvbiB0b1xuICAvLyByZXBvcnQgYmV0dGVyIGVycm9ycy5cbiAgKG5nSG9zdCBhcyBhbnkpLnJlcG9ydE1pc3NpbmdSZXNvdXJjZSA9IChyZXNvdXJjZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxcbkFzc2V0IG5vdCBmb3VuZDpcXG4gICR7cmVzb3VyY2VOYW1lfWApO1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoZWNrIHRoYXQgaXRcXCdzIGluY2x1ZGVkIGluIHRoZSBgYXNzZXRzYCBhdHRyaWJ1dGUgb2YgdGhlIGBuZ19tb2R1bGVgIHJ1bGUuXFxuJyk7XG4gIH07XG5cbiAgY29uc3QgZW1pdENhbGxiYWNrOiBuZy5Uc0VtaXRDYWxsYmFjayA9ICh7XG4gICAgcHJvZ3JhbSxcbiAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgIHdyaXRlRmlsZSxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICB9KSA9PlxuICAgICAgdHNpY2tsZS5lbWl0V2l0aFRzaWNrbGUoXG4gICAgICAgICAgcHJvZ3JhbSwgYmF6ZWxIb3N0LCBiYXplbEhvc3QsIGNvbXBpbGVyT3B0cywgdGFyZ2V0U291cmNlRmlsZSwgd3JpdGVGaWxlLFxuICAgICAgICAgIGNhbmNlbGxhdGlvblRva2VuLCBlbWl0T25seUR0c0ZpbGVzLCB7XG4gICAgICAgICAgICBiZWZvcmVUczogY3VzdG9tVHJhbnNmb3JtZXJzLmJlZm9yZSxcbiAgICAgICAgICAgIGFmdGVyVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlcixcbiAgICAgICAgICB9KTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtKTtcbiAgfVxuICBjb25zdCB7ZGlhZ25vc3RpY3MsIGVtaXRSZXN1bHQsIHByb2dyYW19ID0gbmcucGVyZm9ybUNvbXBpbGF0aW9uKHtcbiAgICByb290TmFtZXM6IGZpbGVzLFxuICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0cyxcbiAgICBob3N0OiBuZ0hvc3QsIGVtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s6IHRzaWNrbGUubWVyZ2VFbWl0UmVzdWx0cywgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoIWJhemVsT3B0cy5ub2RlTW9kdWxlc1ByZWZpeCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIG5vZGUgbW9kdWxlcywgdGhlbiBtZXRhZGF0YS5qc29uIHNob3VsZCBiZSBlbWl0dGVkIHNpbmNlXG4gICAgLy8gdGhlcmUgaXMgbm8gb3RoZXIgd2F5IHRvIG9idGFpbiB0aGUgaW5mb3JtYXRpb25cbiAgICBnZW5lcmF0ZU1ldGFkYXRhSnNvbihwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCBmaWxlcywgY29tcGlsZXJPcHRzLnJvb3REaXJzLCBiYXplbEJpbiwgdHNIb3N0KTtcbiAgfVxuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgd3JpdHRlbkV4cGVjdGVkT3V0cy5sZW5ndGg7IGkrKykge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKHdyaXR0ZW5FeHBlY3RlZE91dHNbaV0sICcnLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBtZXRhZGF0YS5qc29uIGZvciB0aGUgc3BlY2lmaWVkIGBmaWxlc2AuIEJ5IGRlZmF1bHQsIG1ldGFkYXRhLmpzb25cbiAqIGlzIG9ubHkgZ2VuZXJhdGVkIGJ5IHRoZSBjb21waWxlciBpZiAtLWZsYXRNb2R1bGVPdXRGaWxlIGlzIHNwZWNpZmllZC4gQnV0XG4gKiBpZiBjb21waWxlZCB1bmRlciBibGF6ZSwgd2Ugd2FudCB0aGUgbWV0YWRhdGEgdG8gYmUgZ2VuZXJhdGVkIGZvciBlYWNoXG4gKiBBbmd1bGFyIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVNZXRhZGF0YUpzb24oXG4gICAgcHJvZ3JhbTogdHMuUHJvZ3JhbSwgZmlsZXM6IHN0cmluZ1tdLCByb290RGlyczogc3RyaW5nW10sIGJhemVsQmluOiBzdHJpbmcsXG4gICAgdHNIb3N0OiB0cy5Db21waWxlckhvc3QpIHtcbiAgY29uc3QgY29sbGVjdG9yID0gbmV3IG5nLk1ldGFkYXRhQ29sbGVjdG9yKCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoc291cmNlRmlsZSkge1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBjb2xsZWN0b3IuZ2V0TWV0YWRhdGEoc291cmNlRmlsZSk7XG4gICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPSByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZSwgcm9vdERpcnMpO1xuICAgICAgICBjb25zdCBzaG9ydFBhdGggPSByZWxhdGl2ZS5yZXBsYWNlKEVYVCwgJy5tZXRhZGF0YS5qc29uJyk7XG4gICAgICAgIGNvbnN0IG91dEZpbGUgPSByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHNob3J0UGF0aCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSk7XG4gICAgICAgIHRzSG9zdC53cml0ZUZpbGUob3V0RmlsZSwgZGF0YSwgZmFsc2UsIHVuZGVmaW5lZCwgW10pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIU5HQ19HRU5fRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiZcbiAgICAgIChiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICAgIG9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgbmdQcm9ncmFtOiBuZy5Qcm9ncmFtKTogKG5nLkRpYWdub3N0aWMgfCB0cy5EaWFnbm9zdGljKVtdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuICBjb25zdCBkaWFnbm9zdGljczogKG5nLkRpYWdub3N0aWMgfCB0cy5EaWFnbm9zdGljKVtdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKGYgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gIH1cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBwcm9jZXNzLmV4aXRDb2RlID0gbWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpO1xufVxuIl19