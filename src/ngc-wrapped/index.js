/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel", ["require", "exports", "@bazel/typescript", "fs", "path", "tsickle/src/tsickle", "typescript", "url"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.patchNgHostWithFileNameToModuleName = exports.compile = exports.relativeToRootDirs = exports.runOneBuild = exports.main = void 0;
    const typescript_1 = require("@bazel/typescript");
    const fs = __importStar(require("fs"));
    const path = __importStar(require("path"));
    const tsickle = __importStar(require("tsickle/src/tsickle"));
    const typescript_2 = __importDefault(require("typescript"));
    const url_1 = require("url");
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
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, typescript_1.runAsWorker)(args)) {
                yield (0, typescript_1.runWorkerLoop)(runOneBuild);
            }
            else {
                return (yield runOneBuild(args)) ? 0 : 1;
            }
            return 0;
        });
    }
    exports.main = main;
    /** The one FileCache instance used in this process. */
    const fileCache = new typescript_1.FileCache(typescript_1.debug);
    /**
     * Loads a module that can either be CommonJS or an ESModule. This is done
     * as interop with the current devmode CommonJS and prodmode ESM output.
     */
    function loadModuleInterop(moduleName) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // Note: This assumes that there are no conditional exports switching between `import`
            // or `require`. We cannot fully rely on the dynamic import expression here because the
            // Bazel NodeJS rules do not patch the `import` NodeJS module resolution, and this would
            // make ngc-wrapped dependent on the linker. The linker is not enabled when the `ngc-wrapped`
            // binary is shipped in the NPM package and is not available in Google3 either.
            const resolvedUrl = (0, url_1.pathToFileURL)(require.resolve(moduleName));
            const exports = yield new Function('m', `return import(m);`)(resolvedUrl);
            return (_a = exports.default) !== null && _a !== void 0 ? _a : exports;
        });
    }
    function runOneBuild(args, inputs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (args[0] === '-p')
                args.shift();
            // Strip leading at-signs, used to indicate a params file
            const project = args[0].replace(/^@+/, '');
            // Note: We load the compiler-cli package dynamically using `loadModuleInterop` as
            // this script runs as CommonJS module but the compiler-cli could be built as strict ESM
            // package. Unfortunately we have a mix of CommonJS and ESM output here because the devmode
            // output is still using CommonJS and this is primarily used for testing. Also inside G3,
            // the devmode output will remain CommonJS regardless for now.
            // TODO: Fix this up once devmode and prodmode are combined and we use ESM everywhere.
            const compilerExports = yield loadModuleInterop('@angular/compiler-cli');
            const compilerPrivateExports = yield loadModuleInterop('@angular/compiler-cli/private/bazel');
            const ng = Object.assign(Object.assign({}, compilerExports), compilerPrivateExports);
            const [parsedOptions, errors] = (0, typescript_1.parseTsconfig)(project);
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
            const tsHost = typescript_2.default.createCompilerHost(compilerOpts, true);
            const { diagnostics } = compile({
                allDepsCompiledWithBazel: ALL_DEPS_COMPILED_WITH_BAZEL,
                useManifestPathsAsModuleName: _useManifestPathsAsModuleName,
                expectedOuts: expectedOut,
                compilerOpts,
                tsHost,
                bazelOpts,
                files,
                inputs,
                ng,
            });
            if (diagnostics.length) {
                console.error(ng.formatDiagnostics(diagnostics));
            }
            return diagnostics.every(d => d.category !== typescript_2.default.DiagnosticCategory.Error);
        });
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
    function compile({ allDepsCompiledWithBazel = true, useManifestPathsAsModuleName, compilerOpts, tsHost, bazelOpts, files, inputs, expectedOuts, gatherDiagnostics, bazelHost, ng, }) {
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
                resolvedInputs.set((0, typescript_1.resolveNormalizedPath)(key), inputs[key]);
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
            return typescript_2.default.resolveModuleName(moduleName, containingFile, compilerOptions, generatedFileModuleResolverHost);
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
                return (0, typescript_1.resolveNormalizedPath)(bazelBin, workspaceRelative) + '.d.ts';
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
            gatherDiagnostics = (program) => gatherDiagnosticsForInputsOnly(compilerOpts, bazelOpts, program, ng);
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
        const hasError = diagnostics.some((diag) => diag.category === typescript_2.default.DiagnosticCategory.Error);
        if (!hasError) {
            if (bazelOpts.tsickleGenerateExterns) {
                externs += tsickle.getGeneratedExterns(tsickleEmitResult.externs);
            }
            if (bazelOpts.manifest) {
                const manifest = (0, typescript_1.constructManifest)(tsickleEmitResult.modulesManifest, bazelHost);
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
            generateMetadataJson(program.getTsProgram(), files, compilerOpts.rootDirs, bazelBin, tsHost, ng);
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
    function generateMetadataJson(program, files, rootDirs, bazelBin, tsHost, ng) {
        const collector = new ng.MetadataCollector();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const sourceFile = program.getSourceFile(file);
            if (sourceFile) {
                const metadata = collector.getMetadata(sourceFile);
                if (metadata) {
                    const relative = relativeToRootDirs(file, rootDirs);
                    const shortPath = relative.replace(EXT, '.metadata.json');
                    const outFile = (0, typescript_1.resolveNormalizedPath)(bazelBin, shortPath);
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
    function gatherDiagnosticsForInputsOnly(options, bazelOpts, ngProgram, ng) {
        const tsProgram = ngProgram.getTsProgram();
        // For the Ivy compiler, track the amount of time spent fetching TypeScript diagnostics.
        let previousPhase = ng.PerfPhase.Unaccounted;
        if (ngProgram instanceof ng.NgtscProgram) {
            previousPhase = ngProgram.compiler.perfRecorder.phase(ng.PerfPhase.TypeScriptDiagnostics);
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
        main(process.argv.slice(2)).then(exitCode => process.exitCode = exitCode).catch(e => {
            console.error(e);
            process.exitCode = 1;
        });
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
                const sourceFile = ngHost.getSourceFile(importedFilePath, typescript_2.default.ScriptTarget.Latest);
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
            if ((compilerOpts.module === typescript_2.default.ModuleKind.UMD || compilerOpts.module === typescript_2.default.ModuleKind.AMD) &&
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUdILGtEQUFzTjtJQUN0Tix1Q0FBeUI7SUFDekIsMkNBQTZCO0lBQzdCLDZEQUFtQztJQUNuQyw0REFBNEI7SUFDNUIsNkJBQWtDO0lBS2xDLE1BQU0sR0FBRyxHQUFHLGtDQUFrQyxDQUFDO0lBQy9DLE1BQU0sYUFBYSxHQUFHLDBEQUEwRCxDQUFDO0lBQ2pGLDJFQUEyRTtJQUMzRSxtQkFBbUI7SUFDbkIsTUFBTSxVQUFVLEdBQUcsK0JBQStCLENBQUM7SUFFbkQsTUFBTSxTQUFTLEdBQUcsaUNBQWlDLENBQUM7SUFFcEQsNEVBQTRFO0lBQzVFLE1BQU0sNEJBQTRCLEdBQUcsS0FBSyxDQUFDO0lBRTNDLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztJQUVyQyxTQUFzQixJQUFJLENBQUMsSUFBSTs7WUFDN0IsSUFBSSxJQUFBLHdCQUFXLEVBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3JCLE1BQU0sSUFBQSwwQkFBYSxFQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ2xDO2lCQUFNO2dCQUNMLE9BQU8sQ0FBQSxNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDeEM7WUFDRCxPQUFPLENBQUMsQ0FBQztRQUNYLENBQUM7S0FBQTtJQVBELG9CQU9DO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBZ0Isa0JBQUssQ0FBQyxDQUFDO0lBRXREOzs7T0FHRztJQUNILFNBQWUsaUJBQWlCLENBQUksVUFBa0I7OztZQUNwRCxzRkFBc0Y7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QUFDLEtBQUssa0JBQWtCLEVBQUUsQ0FBQztRQUM3RixDQUFDO0lBQ0gsQ0FBQztJQS9GRCxrRkErRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUge0FuZ3VsYXJDb21waWxlck9wdGlvbnMsIENvbXBpbGVySG9zdCBhcyBOZ0NvbXBpbGVySG9zdCwgVHNFbWl0Q2FsbGJhY2ssIFByb2dyYW0sIERpYWdub3N0aWNzLCBEaWFnbm9zdGljIGFzIE5nRGlhZ25vc3RpYywgQ29tcGlsZXJPcHRpb25zfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHtCYXplbE9wdGlvbnMsIENhY2hlZEZpbGVMb2FkZXIsIENvbXBpbGVySG9zdCwgY29uc3RydWN0TWFuaWZlc3QsIGRlYnVnLCBGaWxlQ2FjaGUsIEZpbGVMb2FkZXIsIHBhcnNlVHNjb25maWcsIHJlc29sdmVOb3JtYWxpemVkUGF0aCwgcnVuQXNXb3JrZXIsIHJ1bldvcmtlckxvb3AsIFVuY2FjaGVkRmlsZUxvYWRlcn0gZnJvbSAnQGJhemVsL3R5cGVzY3JpcHQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHRzaWNrbGUgZnJvbSAndHNpY2tsZSc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge3BhdGhUb0ZpbGVVUkx9IGZyb20gJ3VybCc7XG5cbnR5cGUgQ29tcGlsZXJDbGlNb2R1bGUgPVxuICAgIHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpJnR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9wcml2YXRlL2JhemVsJyk7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXdhaXQgcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbi8qKlxuICogTG9hZHMgYSBtb2R1bGUgdGhhdCBjYW4gZWl0aGVyIGJlIENvbW1vbkpTIG9yIGFuIEVTTW9kdWxlLiBUaGlzIGlzIGRvbmVcbiAqIGFzIGludGVyb3Agd2l0aCB0aGUgY3VycmVudCBkZXZtb2RlIENvbW1vbkpTIGFuZCBwcm9kbW9kZSBFU00gb3V0cHV0LlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkTW9kdWxlSW50ZXJvcDxUPihtb2R1bGVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPFQ+IHtcbiAgLy8gTm90ZTogVGhpcyBhc3N1bWVzIHRoYXQgdGhlcmUgYXJlIG5vIGNvbmRpdGlvbmFsIGV4cG9ydHMgc3dpdGNoaW5nIGJldHdlZW4gYGltcG9ydGBcbiAgLy8gb3IgYHJlcXVpcmVgLiBXZSBjYW5ub3QgZnVsbHkgcmVseSBvbiB0aGUgZHluYW1pYyBpbXBvcnQgZXhwcmVzc2lvbiBoZXJlIGJlY2F1c2UgdGhlXG4gIC8vIEJhemVsIE5vZGVKUyBydWxlcyBkbyBub3QgcGF0Y2ggdGhlIGBpbXBvcnRgIE5vZGVKUyBtb2R1bGUgcmVzb2x1dGlvbiwgYW5kIHRoaXMgd291bGRcbiAgLy8gbWFrZSBuZ2Mtd3JhcHBlZCBkZXBlbmRlbnQgb24gdGhlIGxpbmtlci4gVGhlIGxpbmtlciBpcyBub3QgZW5hYmxlZCB3aGVuIHRoZSBgbmdjLXdyYXBwZWRgXG4gIC8vIGJpbmFyeSBpcyBzaGlwcGVkIGluIHRoZSBOUE0gcGFja2FnZSBhbmQgaXMgbm90IGF2YWlsYWJsZSBpbiBHb29nbGUzIGVpdGhlci5cbiAgY29uc3QgcmVzb2x2ZWRVcmwgPSBwYXRoVG9GaWxlVVJMKHJlcXVpcmUucmVzb2x2ZShtb2R1bGVOYW1lKSk7XG4gIGNvbnN0IGV4cG9ydHM6IFBhcnRpYWw8VD4me2RlZmF1bHQ/OiBUfSA9XG4gICAgICBhd2FpdCBuZXcgRnVuY3Rpb24oJ20nLCBgcmV0dXJuIGltcG9ydChtKTtgKShyZXNvbHZlZFVybCk7XG4gIHJldHVybiBleHBvcnRzLmRlZmF1bHQgPz8gZXhwb3J0cyBhcyBUO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuT25lQnVpbGQoXG4gICAgYXJnczogc3RyaW5nW10sIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoYXJnc1swXSA9PT0gJy1wJykgYXJncy5zaGlmdCgpO1xuICAvLyBTdHJpcCBsZWFkaW5nIGF0LXNpZ25zLCB1c2VkIHRvIGluZGljYXRlIGEgcGFyYW1zIGZpbGVcbiAgY29uc3QgcHJvamVjdCA9IGFyZ3NbMF0ucmVwbGFjZSgvXkArLywgJycpO1xuXG4gIC8vIE5vdGU6IFdlIGxvYWQgdGhlIGNvbXBpbGVyLWNsaSBwYWNrYWdlIGR5bmFtaWNhbGx5IHVzaW5nIGBsb2FkTW9kdWxlSW50ZXJvcGAgYXNcbiAgLy8gdGhpcyBzY3JpcHQgcnVucyBhcyBDb21tb25KUyBtb2R1bGUgYnV0IHRoZSBjb21waWxlci1jbGkgY291bGQgYmUgYnVpbHQgYXMgc3RyaWN0IEVTTVxuICAvLyBwYWNrYWdlLiBVbmZvcnR1bmF0ZWx5IHdlIGhhdmUgYSBtaXggb2YgQ29tbW9uSlMgYW5kIEVTTSBvdXRwdXQgaGVyZSBiZWNhdXNlIHRoZSBkZXZtb2RlXG4gIC8vIG91dHB1dCBpcyBzdGlsbCB1c2luZyBDb21tb25KUyBhbmQgdGhpcyBpcyBwcmltYXJpbHkgdXNlZCBmb3IgdGVzdGluZy4gQWxzbyBpbnNpZGUgRzMsXG4gIC8vIHRoZSBkZXZtb2RlIG91dHB1dCB3aWxsIHJlbWFpbiBDb21tb25KUyByZWdhcmRsZXNzIGZvciBub3cuXG4gIC8vIFRPRE86IEZpeCB0aGlzIHVwIG9uY2UgZGV2bW9kZSBhbmQgcHJvZG1vZGUgYXJlIGNvbWJpbmVkIGFuZCB3ZSB1c2UgRVNNIGV2ZXJ5d2hlcmUuXG4gIGNvbnN0IGNvbXBpbGVyRXhwb3J0cyA9XG4gICAgICBhd2FpdCBsb2FkTW9kdWxlSW50ZXJvcDx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuICBjb25zdCBjb21waWxlclByaXZhdGVFeHBvcnRzID1cbiAgICAgIGF3YWl0IGxvYWRNb2R1bGVJbnRlcm9wPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9wcml2YXRlL2JhemVsJyk+KFxuICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCcpO1xuICBjb25zdCBuZyA9IHsuLi5jb21waWxlckV4cG9ydHMsIC4uLmNvbXBpbGVyUHJpdmF0ZUV4cG9ydHN9O1xuXG4gIGNvbnN0IFtwYXJzZWRPcHRpb25zLCBlcnJvcnNdID0gcGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB7YmF6ZWxPcHRzLCBvcHRpb25zOiB0c09wdGlvbnMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3Qge2Vycm9yczogdXNlckVycm9ycywgb3B0aW9uczogdXNlck9wdGlvbnN9ID0gbmcucmVhZENvbmZpZ3VyYXRpb24ocHJvamVjdCk7XG5cbiAgaWYgKHVzZXJFcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3ModXNlckVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcyA9IG5ldyBTZXQ8c3RyaW5nPihbXG4gICAgJ2RpYWdub3N0aWNzJyxcbiAgICAndHJhY2UnLFxuICAgICdkaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nJyxcbiAgICAnZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2snLFxuICAgICdpMThuT3V0TG9jYWxlJyxcbiAgICAnaTE4bk91dEZvcm1hdCcsXG4gICAgJ2kxOG5PdXRGaWxlJyxcbiAgICAnaTE4bkluTG9jYWxlJyxcbiAgICAnaTE4bkluRmlsZScsXG4gICAgJ2kxOG5JbkZvcm1hdCcsXG4gICAgJ2kxOG5Vc2VFeHRlcm5hbElkcycsXG4gICAgJ2kxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMnLFxuICAgICdwcmVzZXJ2ZVdoaXRlc3BhY2VzJyxcbiAgICAnY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwge30pO1xuXG4gIGNvbnN0IGNvbXBpbGVyT3B0czogQW5ndWxhckNvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICAuLi51c2VyT3ZlcnJpZGVzLFxuICAgIC4uLmNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddLFxuICAgIC4uLnRzT3B0aW9ucyxcbiAgfTtcblxuICAvLyBUaGVzZSBhcmUgb3B0aW9ucyBwYXNzZWQgdGhyb3VnaCBmcm9tIHRoZSBgbmdfbW9kdWxlYCBydWxlIHdoaWNoIGFyZW4ndCBzdXBwb3J0ZWRcbiAgLy8gYnkgdGhlIGBAYW5ndWxhci9jb21waWxlci1jbGlgIGFuZCBhcmUgb25seSBpbnRlbmRlZCBmb3IgYG5nYy13cmFwcGVkYC5cbiAgY29uc3Qge2V4cGVjdGVkT3V0LCBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZX0gPSBjb25maWdbJ2FuZ3VsYXJDb21waWxlck9wdGlvbnMnXTtcblxuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgICBleHBlY3RlZE91dHM6IGV4cGVjdGVkT3V0LFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICB0c0hvc3QsXG4gICAgYmF6ZWxPcHRzLFxuICAgIGZpbGVzLFxuICAgIGlucHV0cyxcbiAgICBuZyxcbiAgfSk7XG4gIGlmIChkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGRpYWdub3N0aWNzKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzLmV2ZXJ5KGQgPT4gZC5jYXRlZ29yeSAhPT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlUGF0aDogc3RyaW5nLCByb290RGlyczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gZmlsZVBhdGg7XG4gIC8vIE5COiB0aGUgcm9vdERpcnMgc2hvdWxkIGhhdmUgYmVlbiBzb3J0ZWQgbG9uZ2VzdC1maXJzdFxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3REaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZGlyID0gcm9vdERpcnNbaV07XG4gICAgY29uc3QgcmVsID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShkaXIsIGZpbGVQYXRoKTtcbiAgICBpZiAocmVsLmluZGV4T2YoJy4nKSAhPSAwKSByZXR1cm4gcmVsO1xuICB9XG4gIHJldHVybiBmaWxlUGF0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGUoe1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwgPSB0cnVlLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICBjb21waWxlck9wdHMsXG4gIHRzSG9zdCxcbiAgYmF6ZWxPcHRzLFxuICBmaWxlcyxcbiAgaW5wdXRzLFxuICBleHBlY3RlZE91dHMsXG4gIGdhdGhlckRpYWdub3N0aWNzLFxuICBiYXplbEhvc3QsXG4gIG5nLFxufToge1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lPzogYm9vbGVhbiwgY29tcGlsZXJPcHRzOiBDb21waWxlck9wdGlvbnMsIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0LFxuICBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sXG4gICAgICAgIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICAgICAgICBmaWxlczogc3RyaW5nW10sXG4gICAgICAgIGV4cGVjdGVkT3V0czogc3RyaW5nW10sXG4gIGdhdGhlckRpYWdub3N0aWNzPzogKHByb2dyYW06IFByb2dyYW0pID0+IERpYWdub3N0aWNzLFxuICBiYXplbEhvc3Q/OiBDb21waWxlckhvc3QsIG5nOiBDb21waWxlckNsaU1vZHVsZSxcbn0pOiB7ZGlhZ25vc3RpY3M6IERpYWdub3N0aWNzLCBwcm9ncmFtOiBQcm9ncmFtfSB7XG4gIGxldCBmaWxlTG9hZGVyOiBGaWxlTG9hZGVyO1xuXG4gIGlmIChiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG1heENhY2hlU2l6ZUJ5dGVzID0gYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICogKDEgPDwgMjApO1xuICAgIGZpbGVDYWNoZS5zZXRNYXhDYWNoZVNpemUobWF4Q2FjaGVTaXplQnl0ZXMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVDYWNoZS5yZXNldE1heENhY2hlU2l6ZSgpO1xuICB9XG5cbiAgaWYgKGlucHV0cykge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgQ2FjaGVkRmlsZUxvYWRlcihmaWxlQ2FjaGUpO1xuICAgIC8vIFJlc29sdmUgdGhlIGlucHV0cyB0byBhYnNvbHV0ZSBwYXRocyB0byBtYXRjaCBUeXBlU2NyaXB0IGludGVybmFsc1xuICAgIGNvbnN0IHJlc29sdmVkSW5wdXRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBjb25zdCBpbnB1dEtleXMgPSBPYmplY3Qua2V5cyhpbnB1dHMpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBrZXkgPSBpbnB1dEtleXNbaV07XG4gICAgICByZXNvbHZlZElucHV0cy5zZXQocmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGtleSksIGlucHV0c1trZXldKTtcbiAgICB9XG4gICAgZmlsZUNhY2hlLnVwZGF0ZUNhY2hlKHJlc29sdmVkSW5wdXRzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IFVuY2FjaGVkRmlsZUxvYWRlcigpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IGZyb20gY29tcGlsZXJPcHRzIHdoZXRoZXIgdGhlIGVudHJ5cG9pbnQgaXMgYmVpbmcgaW52b2tlZCBpbiBJdnkgbW9kZS5cbiAgY29uc3QgaXNJbkl2eU1vZGUgPSAhIWNvbXBpbGVyT3B0cy5lbmFibGVJdnk7XG4gIGlmICghY29tcGlsZXJPcHRzLnJvb3REaXJzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdyb290RGlycyBpcyBub3Qgc2V0IScpO1xuICB9XG4gIGNvbnN0IGJhemVsQmluID0gY29tcGlsZXJPcHRzLnJvb3REaXJzLmZpbmQocm9vdERpciA9PiBCQVpFTF9CSU4udGVzdChyb290RGlyKSk7XG4gIGlmICghYmF6ZWxCaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgYmF6ZWwgYmluIGluIHRoZSByb290RGlyczogJHtjb21waWxlck9wdHMucm9vdERpcnN9YCk7XG4gIH1cblxuICBjb25zdCBleHBlY3RlZE91dHNTZXQgPSBuZXcgU2V0KGV4cGVjdGVkT3V0cy5tYXAocCA9PiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKHApKSk7XG5cbiAgY29uc3Qgb3JpZ2luYWxXcml0ZUZpbGUgPSB0c0hvc3Qud3JpdGVGaWxlLmJpbmQodHNIb3N0KTtcbiAgdHNIb3N0LndyaXRlRmlsZSA9XG4gICAgICAoZmlsZU5hbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCB3cml0ZUJ5dGVPcmRlck1hcms6IGJvb2xlYW4sXG4gICAgICAgb25FcnJvcj86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQsIHNvdXJjZUZpbGVzPzogdHMuU291cmNlRmlsZVtdKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlID1cbiAgICAgICAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVOYW1lKSwgW2NvbXBpbGVyT3B0cy5yb290RGlyXSk7XG4gICAgICAgIGlmIChleHBlY3RlZE91dHNTZXQuaGFzKHJlbGF0aXZlKSkge1xuICAgICAgICAgIGV4cGVjdGVkT3V0c1NldC5kZWxldGUocmVsYXRpdmUpO1xuICAgICAgICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCBjb250ZW50LCB3cml0ZUJ5dGVPcmRlck1hcmssIG9uRXJyb3IsIHNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3QgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdCA9IE9iamVjdC5jcmVhdGUodHNIb3N0KTtcbiAgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVySG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBtYXRjaCA9IE5HQ19HRU5fRklMRVMuZXhlYyhmaWxlTmFtZSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbLCBmaWxlLCBzdWZmaXgsIGV4dF0gPSBtYXRjaDtcbiAgICAgIC8vIFBlcmZvcm1hbmNlOiBza2lwIGxvb2tpbmcgZm9yIGZpbGVzIG90aGVyIHRoYW4gLmQudHMgb3IgLnRzXG4gICAgICBpZiAoZXh0ICE9PSAnLnRzJyAmJiBleHQgIT09ICcuZC50cycpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmIChzdWZmaXguaW5kZXhPZignbmdzdHlsZScpID49IDApIHtcbiAgICAgICAgLy8gTG9vayBmb3IgZm9vLmNzcyBvbiBkaXNrXG4gICAgICAgIGZpbGVOYW1lID0gZmlsZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5kLnRzIG9yIGZvby50cyBvbiBkaXNrXG4gICAgICAgIGZpbGVOYW1lID0gZmlsZSArIChleHQgfHwgJycpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcihcbiAgICAgIG1vZHVsZU5hbWU6IHN0cmluZywgY29udGFpbmluZ0ZpbGU6IHN0cmluZyxcbiAgICAgIGNvbXBpbGVyT3B0aW9uczogdHMuQ29tcGlsZXJPcHRpb25zKTogdHMuUmVzb2x2ZWRNb2R1bGVXaXRoRmFpbGVkTG9va3VwTG9jYXRpb25zIHtcbiAgICByZXR1cm4gdHMucmVzb2x2ZU1vZHVsZU5hbWUoXG4gICAgICAgIG1vZHVsZU5hbWUsIGNvbnRhaW5pbmdGaWxlLCBjb21waWxlck9wdGlvbnMsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QpO1xuICB9XG5cbiAgaWYgKCFiYXplbEhvc3QpIHtcbiAgICBiYXplbEhvc3QgPSBuZXcgQ29tcGlsZXJIb3N0KFxuICAgICAgICBmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlciwgZ2VuZXJhdGVkRmlsZU1vZHVsZVJlc29sdmVyKTtcbiAgfVxuXG4gIGlmIChpc0luSXZ5TW9kZSkge1xuICAgIGNvbnN0IGRlbGVnYXRlID0gYmF6ZWxIb3N0LnNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZy5iaW5kKGJhemVsSG9zdCk7XG4gICAgYmF6ZWxIb3N0LnNob3VsZFNraXBUc2lja2xlUHJvY2Vzc2luZyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAvLyBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBzaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgY2hlY2tzIHdoZXRoZXIgYGZpbGVOYW1lYCBpcyBwYXJ0IG9mXG4gICAgICAvLyB0aGUgb3JpZ2luYWwgYHNyY3NbXWAuIEZvciBBbmd1bGFyIChJdnkpIGNvbXBpbGF0aW9ucywgbmdmYWN0b3J5L25nc3VtbWFyeSBmaWxlcyB0aGF0IGFyZVxuICAgICAgLy8gc2hpbXMgZm9yIG9yaWdpbmFsIC50cyBmaWxlcyBpbiB0aGUgcHJvZ3JhbSBzaG91bGQgYmUgdHJlYXRlZCBpZGVudGljYWxseS4gVGh1cywgc3RyaXAgdGhlXG4gICAgICAvLyAnLm5nZmFjdG9yeScgb3IgJy5uZ3N1bW1hcnknIHBhcnQgb2YgdGhlIGZpbGVuYW1lIGF3YXkgYmVmb3JlIGNhbGxpbmcgdGhlIGRlbGVnYXRlLlxuICAgICAgcmV0dXJuIGRlbGVnYXRlKGZpbGVOYW1lLnJlcGxhY2UoL1xcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5KVxcLnRzJC8sICcudHMnKSk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEJ5IGRlZmF1bHQsIGRpc2FibGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtaW5nIGluIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QuXG4gIC8vIFRoZSBBbmd1bGFyIGNvbXBpbGVycyBoYXZlIHRoZWlyIG93biBsb2dpYyBmb3IgZGVjb3JhdG9yIHByb2Nlc3NpbmcgYW5kIHdlIHdvdWxkbid0XG4gIC8vIHdhbnQgdHNpY2tsZSB0byBpbnRlcmZlcmUgd2l0aCB0aGF0LlxuICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IGZhbHNlO1xuXG4gIC8vIEJ5IGRlZmF1bHQgaW4gdGhlIGBwcm9kbW9kZWAgb3V0cHV0LCB3ZSBkbyBub3QgYWRkIGFubm90YXRpb25zIGZvciBjbG9zdXJlIGNvbXBpbGVyLlxuICAvLyBUaG91Z2gsIGlmIHdlIGFyZSBidWlsZGluZyBpbnNpZGUgYGdvb2dsZTNgLCBjbG9zdXJlIGFubm90YXRpb25zIGFyZSBkZXNpcmVkIGZvclxuICAvLyBwcm9kbW9kZSBvdXRwdXQsIHNvIHdlIGVuYWJsZSBpdCBieSBkZWZhdWx0LiBUaGUgZGVmYXVsdHMgY2FuIGJlIG92ZXJyaWRkZW4gYnlcbiAgLy8gc2V0dGluZyB0aGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBjb21waWxlciBvcHRpb24gaW4gdGhlIHVzZXIgdHNjb25maWcuXG4gIGlmICghYmF6ZWxPcHRzLmVzNU1vZGUpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUgPT09ICdnb29nbGUzJykge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gdHJ1ZTtcbiAgICAgIC8vIEVuYWJsZSB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtIGluIGdvb2dsZTMgd2l0aCBJdnkgbW9kZSBlbmFibGVkLiBUaGUgdHNpY2tsZVxuICAgICAgLy8gZGVjb3JhdG9yIHRyYW5zZm9ybWF0aW9uIGlzIHN0aWxsIG5lZWRlZC4gVGhpcyBtaWdodCBiZSBiZWNhdXNlIG9mIGN1c3RvbSBkZWNvcmF0b3JzXG4gICAgICAvLyB3aXRoIHRoZSBgQEFubm90YXRpb25gIEpTRG9jIHRoYXQgd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybS5cbiAgICAgIC8vIFRPRE86IEZpZ3VyZSBvdXQgd2h5IHRoaXMgaXMgbmVlZGVkIGluIGczIGFuZCBob3cgd2UgY2FuIGltcHJvdmUgdGhpcy4gRlctMjIyNVxuICAgICAgaWYgKGlzSW5JdnlNb2RlKSB7XG4gICAgICAgIGJhemVsSG9zdC50cmFuc2Zvcm1EZWNvcmF0b3JzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgQW5ndWxhciBjb21waWxlciBvcHRpb24gaXMgbm90IHJlc3BlY3RlZCBieSBkZWZhdWx0XG4gIC8vIGFzIG5nYy13cmFwcGVkIGhhbmRsZXMgdHNpY2tsZSBlbWl0IG9uIGl0cyBvd24uIFRoaXMgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHVwZGF0ZVxuICAvLyB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0IGJhc2VkIG9uIHRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIGZsYWcuXG4gIGlmIChjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIpIHtcbiAgICBiYXplbEhvc3QudHJhbnNmb3JtVHlwZXNUb0Nsb3N1cmUgPSB0cnVlO1xuICB9XG5cbiAgY29uc3Qgb3JpZ0JhemVsSG9zdEZpbGVFeGlzdCA9IGJhemVsSG9zdC5maWxlRXhpc3RzO1xuICBiYXplbEhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKE5HQ19BU1NFVFMudGVzdChmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0LmNhbGwoYmF6ZWxIb3N0LCBmaWxlTmFtZSk7XG4gIH07XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlID0gYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZmxhdE1vZHVsZU91dFBhdGggPVxuICAgICAgICBwYXRoLnBvc2l4LmpvaW4oYmF6ZWxPcHRzLnBhY2thZ2UsIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnKTtcblxuICAgIC8vIFRoZSBidW5kbGUgaW5kZXggZmlsZSBpcyBzeW50aGVzaXplZCBpbiBidW5kbGVfaW5kZXhfaG9zdCBzbyBpdCdzIG5vdCBpbiB0aGVcbiAgICAvLyBjb21waWxhdGlvblRhcmdldFNyYy5cbiAgICAvLyBIb3dldmVyIHdlIHN0aWxsIHdhbnQgdG8gZ2l2ZSBpdCBhbiBBTUQgbW9kdWxlIG5hbWUgZm9yIGRldm1vZGUuXG4gICAgLy8gV2UgY2FuJ3QgZWFzaWx5IHRlbGwgd2hpY2ggZmlsZSBpcyB0aGUgc3ludGhldGljIG9uZSwgc28gd2UgYnVpbGQgdXAgdGhlIHBhdGggd2UgZXhwZWN0XG4gICAgLy8gaXQgdG8gaGF2ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsIGZsYXRNb2R1bGVPdXRQYXRoKSkgcmV0dXJuIHRydWU7XG5cbiAgICAvLyBBbHNvIGhhbmRsZSB0aGUgY2FzZSB0aGUgdGFyZ2V0IGlzIGluIGFuIGV4dGVybmFsIHJlcG9zaXRvcnkuXG4gICAgLy8gUHVsbCB0aGUgd29ya3NwYWNlIG5hbWUgZnJvbSB0aGUgdGFyZ2V0IHdoaWNoIGlzIGZvcm1hdHRlZCBhcyBgQHdrc3AvL3BhY2thZ2U6dGFyZ2V0YFxuICAgIC8vIGlmIGl0IHRoZSB0YXJnZXQgaXMgZnJvbSBhbiBleHRlcm5hbCB3b3Jrc3BhY2UuIElmIHRoZSB0YXJnZXQgaXMgZnJvbSB0aGUgbG9jYWxcbiAgICAvLyB3b3Jrc3BhY2UgdGhlbiBpdCB3aWxsIGJlIGZvcm1hdHRlZCBhcyBgLy9wYWNrYWdlOnRhcmdldGAuXG4gICAgY29uc3QgdGFyZ2V0V29ya3NwYWNlID0gYmF6ZWxPcHRzLnRhcmdldC5zcGxpdCgnLycpWzBdLnJlcGxhY2UoL15ALywgJycpO1xuXG4gICAgaWYgKHRhcmdldFdvcmtzcGFjZSAmJlxuICAgICAgICBmaWxlTmFtZSA9PT1cbiAgICAgICAgICAgIHBhdGgucG9zaXguam9pbihjb21waWxlck9wdHMuYmFzZVVybCwgJ2V4dGVybmFsJywgdGFyZ2V0V29ya3NwYWNlLCBmbGF0TW9kdWxlT3V0UGF0aCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSkgfHwgTkdDX0dFTl9GSUxFUy50ZXN0KGZpbGVOYW1lKTtcbiAgfTtcblxuICBjb25zdCBuZ0hvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnM6IGNvbXBpbGVyT3B0cywgdHNIb3N0OiBiYXplbEhvc3R9KTtcbiAgcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgICBuZ0hvc3QsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lKTtcblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IFRzRW1pdENhbGxiYWNrID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QsIGJhemVsSG9zdCwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyLFxuICAgICAgICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlckRlY2xhcmF0aW9ucyxcbiAgICAgICAgICB9KTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtLCBuZyk7XG4gIH1cbiAgY29uc3Qge2RpYWdub3N0aWNzLCBlbWl0UmVzdWx0LCBwcm9ncmFtfSA9IG5nLnBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgcm9vdE5hbWVzOiBmaWxlcyxcbiAgICBvcHRpb25zOiBjb21waWxlck9wdHMsXG4gICAgaG9zdDogbmdIb3N0LFxuICAgIGVtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s6IHRzaWNrbGUubWVyZ2VFbWl0UmVzdWx0cyxcbiAgICBnYXRoZXJEaWFnbm9zdGljc1xuICB9KTtcbiAgY29uc3QgdHNpY2tsZUVtaXRSZXN1bHQgPSBlbWl0UmVzdWx0IGFzIHRzaWNrbGUuRW1pdFJlc3VsdDtcbiAgbGV0IGV4dGVybnMgPSAnLyoqIEBleHRlcm5zICovXFxuJztcbiAgY29uc3QgaGFzRXJyb3IgPSBkaWFnbm9zdGljcy5zb21lKChkaWFnKSA9PiBkaWFnLmNhdGVnb3J5ID09PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xuICBpZiAoIWhhc0Vycm9yKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoIWJhemVsT3B0cy5ub2RlTW9kdWxlc1ByZWZpeCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIG5vZGUgbW9kdWxlcywgdGhlbiBtZXRhZGF0YS5qc29uIHNob3VsZCBiZSBlbWl0dGVkIHNpbmNlXG4gICAgLy8gdGhlcmUgaXMgbm8gb3RoZXIgd2F5IHRvIG9idGFpbiB0aGUgaW5mb3JtYXRpb25cbiAgICBnZW5lcmF0ZU1ldGFkYXRhSnNvbihcbiAgICAgICAgcHJvZ3JhbS5nZXRUc1Byb2dyYW0oKSwgZmlsZXMsIGNvbXBpbGVyT3B0cy5yb290RGlycywgYmF6ZWxCaW4sIHRzSG9zdCwgbmcpO1xuICB9XG5cbiAgaWYgKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgpIHtcbiAgICAvLyBOb3RlOiB3aGVuIHRzaWNrbGVFeHRlcm5zUGF0aCBpcyBwcm92aWRlZCwgd2UgYWx3YXlzIHdyaXRlIGEgZmlsZSBhcyBhXG4gICAgLy8gbWFya2VyIHRoYXQgY29tcGlsYXRpb24gc3VjY2VlZGVkLCBldmVuIGlmIGl0J3MgZW1wdHkgKGp1c3QgY29udGFpbmluZyBhblxuICAgIC8vIEBleHRlcm5zKS5cbiAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgsIGV4dGVybnMpO1xuICB9XG5cbiAgLy8gVGhlcmUgbWlnaHQgYmUgc29tZSBleHBlY3RlZCBvdXRwdXQgZmlsZXMgdGhhdCBhcmUgbm90IHdyaXR0ZW4gYnkgdGhlXG4gIC8vIGNvbXBpbGVyLiBJbiB0aGlzIGNhc2UsIGp1c3Qgd3JpdGUgYW4gZW1wdHkgZmlsZS5cbiAgZm9yIChjb25zdCBmaWxlTmFtZSBvZiBleHBlY3RlZE91dHNTZXQpIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgJycsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIG1ldGFkYXRhLmpzb24gZm9yIHRoZSBzcGVjaWZpZWQgYGZpbGVzYC4gQnkgZGVmYXVsdCwgbWV0YWRhdGEuanNvblxuICogaXMgb25seSBnZW5lcmF0ZWQgYnkgdGhlIGNvbXBpbGVyIGlmIC0tZmxhdE1vZHVsZU91dEZpbGUgaXMgc3BlY2lmaWVkLiBCdXRcbiAqIGlmIGNvbXBpbGVkIHVuZGVyIGJsYXplLCB3ZSB3YW50IHRoZSBtZXRhZGF0YSB0byBiZSBnZW5lcmF0ZWQgZm9yIGVhY2hcbiAqIEFuZ3VsYXIgY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZU1ldGFkYXRhSnNvbihcbiAgICBwcm9ncmFtOiB0cy5Qcm9ncmFtLCBmaWxlczogc3RyaW5nW10sIHJvb3REaXJzOiBzdHJpbmdbXSwgYmF6ZWxCaW46IHN0cmluZyxcbiAgICB0c0hvc3Q6IHRzLkNvbXBpbGVySG9zdCwgbmc6IENvbXBpbGVyQ2xpTW9kdWxlKSB7XG4gIGNvbnN0IGNvbGxlY3RvciA9IG5ldyBuZy5NZXRhZGF0YUNvbGxlY3RvcigpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZmlsZSA9IGZpbGVzW2ldO1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgaWYgKHNvdXJjZUZpbGUpIHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhID0gY29sbGVjdG9yLmdldE1ldGFkYXRhKHNvdXJjZUZpbGUpO1xuICAgICAgaWYgKG1ldGFkYXRhKSB7XG4gICAgICAgIGNvbnN0IHJlbGF0aXZlID0gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGUsIHJvb3REaXJzKTtcbiAgICAgICAgY29uc3Qgc2hvcnRQYXRoID0gcmVsYXRpdmUucmVwbGFjZShFWFQsICcubWV0YWRhdGEuanNvbicpO1xuICAgICAgICBjb25zdCBvdXRGaWxlID0gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCBzaG9ydFBhdGgpO1xuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpO1xuICAgICAgICB0c0hvc3Qud3JpdGVGaWxlKG91dEZpbGUsIGRhdGEsIGZhbHNlLCB1bmRlZmluZWQsIFtdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuICFOR0NfR0VOX0ZJTEVTLnRlc3Qoc2YuZmlsZU5hbWUpICYmXG4gICAgICAoYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluZGV4T2Yoc2YuZmlsZU5hbWUpICE9PSAtMSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgICBvcHRpb25zOiBDb21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBuZ1Byb2dyYW06IFByb2dyYW0sXG4gICAgbmc6IENvbXBpbGVyQ2xpTW9kdWxlKTogKE5nRGlhZ25vc3RpY3x0cy5EaWFnbm9zdGljKVtdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gIC8vIEZvciB0aGUgSXZ5IGNvbXBpbGVyLCB0cmFjayB0aGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgZmV0Y2hpbmcgVHlwZVNjcmlwdCBkaWFnbm9zdGljcy5cbiAgbGV0IHByZXZpb3VzUGhhc2UgPSBuZy5QZXJmUGhhc2UuVW5hY2NvdW50ZWQ7XG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBwcmV2aW91c1BoYXNlID0gbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShuZy5QZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzKTtcbiAgfVxuICBjb25zdCBkaWFnbm9zdGljczogKE5nRGlhZ25vc3RpY3x0cy5EaWFnbm9zdGljKVtdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKGYgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gIH1cblxuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShwcmV2aW91c1BoYXNlKTtcbiAgfVxuXG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgLy8gb25seSBnYXRoZXIgdGhlIGFuZ3VsYXIgZGlhZ25vc3RpY3MgaWYgd2UgaGF2ZSBubyBkaWFnbm9zdGljc1xuICAgIC8vIGluIGFueSBvdGhlciBmaWxlcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgbWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpLnRoZW4oZXhpdENvZGUgPT4gcHJvY2Vzcy5leGl0Q29kZSA9IGV4aXRDb2RlKS5jYXRjaChlID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICB9KTtcbn1cblxuLyoqXG4gKiBBZGRzIHN1cHBvcnQgZm9yIHRoZSBvcHRpb25hbCBgZmlsZU5hbWVUb01vZHVsZU5hbWVgIG9wZXJhdGlvbiB0byBhIGdpdmVuIGBuZy5Db21waWxlckhvc3RgLlxuICpcbiAqIFRoaXMgaXMgdXNlZCB3aXRoaW4gYG5nYy13cmFwcGVkYCBhbmQgdGhlIEJhemVsIGNvbXBpbGF0aW9uIGZsb3csIGJ1dCBpcyBleHBvcnRlZCBoZXJlIHRvIGFsbG93XG4gKiBmb3Igb3RoZXIgY29uc3VtZXJzIG9mIHRoZSBjb21waWxlciB0byBhY2Nlc3MgdGhpcyBzYW1lIGxvZ2ljLiBGb3IgZXhhbXBsZSwgdGhlIHhpMThuIG9wZXJhdGlvblxuICogaW4gZzMgY29uZmlndXJlcyBpdHMgb3duIGBuZy5Db21waWxlckhvc3RgIHdoaWNoIGFsc28gcmVxdWlyZXMgYGZpbGVOYW1lVG9Nb2R1bGVOYW1lYCB0byB3b3JrXG4gKiBjb3JyZWN0bHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRjaE5nSG9zdFdpdGhGaWxlTmFtZVRvTW9kdWxlTmFtZShcbiAgICBuZ0hvc3Q6IE5nQ29tcGlsZXJIb3N0LCBjb21waWxlck9wdHM6IENvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgbmdIb3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lID0gKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBgJHtpbXBvcnRlZEZpbGVQYXRofToke2NvbnRhaW5pbmdGaWxlUGF0aH1gO1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhjYWNoZUtleSkpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmdldChjYWNoZUtleSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCwgY29udGFpbmluZ0ZpbGVQYXRoKTtcbiAgICBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLnNldChjYWNoZUtleSwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlbGF0aXZlVGFyZ2V0UGF0aCA9XG4gICAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgY29uc3QgbWFuaWZlc3RUYXJnZXRQYXRoID0gYCR7YmF6ZWxPcHRzLndvcmtzcGFjZU5hbWV9LyR7cmVsYXRpdmVUYXJnZXRQYXRofWA7XG4gICAgaWYgKHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBtYW5pZmVzdFRhcmdldFBhdGg7XG4gICAgfVxuXG4gICAgLy8gVW5sZXNzIG1hbmlmZXN0IHBhdGhzIGFyZSBleHBsaWNpdGx5IGVuZm9yY2VkLCB3ZSBpbml0aWFsbHkgY2hlY2sgaWYgYSBtb2R1bGUgbmFtZSBpc1xuICAgIC8vIHNldCBmb3IgdGhlIGdpdmVuIHNvdXJjZSBmaWxlLiBUaGUgY29tcGlsZXIgaG9zdCBmcm9tIGBAYmF6ZWwvdHlwZXNjcmlwdGAgc2V0cyBzb3VyY2VcbiAgICAvLyBmaWxlIG1vZHVsZSBuYW1lcyBpZiB0aGUgY29tcGlsYXRpb24gdGFyZ2V0cyBlaXRoZXIgVU1EIG9yIEFNRC4gVG8gZW5zdXJlIHRoYXQgdGhlIEFNRFxuICAgIC8vIG1vZHVsZSBuYW1lcyBtYXRjaCwgd2UgZmlyc3QgY29uc2lkZXIgdGhvc2UuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IChKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpIGFzIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1wb3J0QXM6IHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuaW1wb3J0QXM7XG4gICAgICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG1vZHVsZU5hbWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgICBuZ0hvc3QuYW1kTW9kdWxlTmFtZSkge1xuICAgICAgcmV0dXJuIG5nSG9zdC5hbWRNb2R1bGVOYW1lKHtmaWxlTmFtZTogaW1wb3J0ZWRGaWxlUGF0aH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gQU1EIG1vZHVsZSBuYW1lIGhhcyBiZWVuIHNldCBmb3IgdGhlIHNvdXJjZSBmaWxlIGJ5IHRoZSBgQGJhemVsL3R5cGVzY3JpcHRgIGNvbXBpbGVyXG4gICAgLy8gaG9zdCwgYW5kIHRoZSB0YXJnZXQgZmlsZSBpcyBub3QgcGFydCBvZiBhIGZsYXQgbW9kdWxlIG5vZGUgbW9kdWxlIHBhY2thZ2UsIHdlIHVzZSB0aGVcbiAgICAvLyBmb2xsb3dpbmcgcnVsZXMgKGluIG9yZGVyKTpcbiAgICAvLyAgICAxLiBJZiB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGBub2RlX21vZHVsZXMvYCwgd2UgdXNlIHRoZSBwYWNrYWdlIG1vZHVsZSBuYW1lLlxuICAgIC8vICAgIDIuIElmIG5vIGNvbnRhaW5pbmcgZmlsZSBpcyBzcGVjaWZpZWQsIG9yIHRoZSB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGEgZGlmZmVyZW50XG4gICAgLy8gICAgICAgY29tcGlsYXRpb24gdW5pdCwgd2UgdXNlIGEgQmF6ZWwgbWFuaWZlc3QgcGF0aC4gUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBwb3NzaWJsZVxuICAgIC8vICAgICAgIHNpbmNlIHdlIGRvbid0IGhhdmUgYSBjb250YWluaW5nIGZpbGUsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgY291bGQgYmUgbG9jYXRlZCBpbiB0aGVcbiAgICAvLyAgICAgICBvdXRwdXQgZGlyZWN0b3J5LCBvciBpbiBhbiBleHRlcm5hbCBCYXplbCByZXBvc2l0b3J5LlxuICAgIC8vICAgIDMuIElmIGJvdGggcnVsZXMgYWJvdmUgZGlkbid0IG1hdGNoLCB3ZSBjb21wdXRlIGEgcmVsYXRpdmUgcGF0aCBiZXR3ZWVuIHRoZSBzb3VyY2UgZmlsZXNcbiAgICAvLyAgICAgICBzaW5jZSB0aGV5IGFyZSBwYXJ0IG9mIHRoZSBzYW1lIGNvbXBpbGF0aW9uIHVuaXQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IHdhbnQgdG8gYWx3YXlzIHVzZSAoMikgYmVjYXVzZSBpdCBjb3VsZCBtZWFuIHRoYXQgY29tcGlsYXRpb24gb3V0cHV0c1xuICAgIC8vIGFyZSBhbHdheXMgbGVha2luZyBCYXplbC1zcGVjaWZpYyBwYXRocywgYW5kIHRoZSBvdXRwdXQgaXMgbm90IHNlbGYtY29udGFpbmVkLiBUaGlzIGNvdWxkXG4gICAgLy8gYnJlYWsgYGVzbTIwMTVgIG9yIGBlc201YCBvdXRwdXQgZm9yIEFuZ3VsYXIgcGFja2FnZSByZWxlYXNlIG91dHB1dFxuICAgIC8vIE9taXQgdGhlIGBub2RlX21vZHVsZXNgIHByZWZpeCBpZiB0aGUgbW9kdWxlIG5hbWUgb2YgYW4gTlBNIHBhY2thZ2UgaXMgcmVxdWVzdGVkLlxuICAgIGlmIChyZWxhdGl2ZVRhcmdldFBhdGguc3RhcnRzV2l0aChOT0RFX01PRFVMRVMpKSB7XG4gICAgICByZXR1cm4gcmVsYXRpdmVUYXJnZXRQYXRoLnN1YnN0cihOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjb250YWluaW5nRmlsZVBhdGggPT0gbnVsbCB8fCAhYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluY2x1ZGVzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgICBjb25zdCBjb250YWluaW5nRmlsZURpciA9XG4gICAgICAgIHBhdGguZGlybmFtZShyZWxhdGl2ZVRvUm9vdERpcnMoY29udGFpbmluZ0ZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpKTtcbiAgICBjb25zdCByZWxhdGl2ZUltcG9ydFBhdGggPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGNvbnRhaW5pbmdGaWxlRGlyLCByZWxhdGl2ZVRhcmdldFBhdGgpO1xuICAgIHJldHVybiByZWxhdGl2ZUltcG9ydFBhdGguc3RhcnRzV2l0aCgnLicpID8gcmVsYXRpdmVJbXBvcnRQYXRoIDogYC4vJHtyZWxhdGl2ZUltcG9ydFBhdGh9YDtcbiAgfVxufVxuIl19