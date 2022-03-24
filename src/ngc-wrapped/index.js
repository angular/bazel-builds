/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
    /**
     * Reference to the previously loaded `compiler-cli` module exports. We cache the exports
     * as `ngc-wrapped` can run as part of a worker where the Angular compiler should not be
     * resolved through a dynamic import for every build.
     */
    let _cachedCompilerCliModule = null;
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
    /**
     * Fetches the Angular compiler CLI module dynamically, allowing for an ESM
     * variant of the compiler.
     */
    function fetchCompilerCliModule() {
        return __awaiter(this, void 0, void 0, function* () {
            if (_cachedCompilerCliModule !== null) {
                return _cachedCompilerCliModule;
            }
            // Note: We load the compiler-cli package dynamically using `loadModuleInterop` as
            // this script runs as CommonJS module but the compiler-cli could be built as strict ESM
            // package. Unfortunately we have a mix of CommonJS and ESM output here because the devmode
            // output is still using CommonJS and this is primarily used for testing. Also inside G3,
            // the devmode output will remain CommonJS regardless for now.
            // TODO: Fix this up once devmode and prodmode are combined and we use ESM everywhere.
            const compilerExports = yield loadModuleInterop('@angular/compiler-cli');
            const compilerPrivateExports = yield loadModuleInterop('@angular/compiler-cli/private/bazel');
            return _cachedCompilerCliModule = Object.assign(Object.assign({}, compilerExports), compilerPrivateExports);
        });
    }
    function runOneBuild(args, inputs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (args[0] === '-p') {
                args.shift();
            }
            // Strip leading at-signs, used to indicate a params file
            const project = args[0].replace(/^@+/, '');
            const ng = yield fetchCompilerCliModule();
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
                externs += tsickle.getGeneratedExterns(tsickleEmitResult.externs, compilerOpts.rootDir);
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
                return relativeTargetPath.slice(NODE_MODULES.length);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFHSCxrREFBc047SUFDdE4sdUNBQXlCO0lBQ3pCLDJDQUE2QjtJQUM3Qiw2REFBbUM7SUFDbkMsNERBQTRCO0lBQzVCLDZCQUFrQztJQUtsQzs7OztPQUlHO0lBQ0gsSUFBSSx3QkFBd0IsR0FBMkIsSUFBSSxDQUFDO0lBRTVELE1BQU0sR0FBRyxHQUFHLGtDQUFrQyxDQUFDO0lBQy9DLE1BQU0sYUFBYSxHQUFHLDBEQUEwRCxDQUFDO0lBQ2pGLDJFQUEyRTtJQUMzRSxtQkFBbUI7SUFDbkIsTUFBTSxVQUFVLEdBQUcsK0JBQStCLENBQUM7SUFFbkQsTUFBTSxTQUFTLEdBQUcsaUNBQWlDLENBQUM7SUFFcEQsNEVBQTRFO0lBQzVFLE1BQU0sNEJBQTRCLEdBQUcsS0FBSyxDQUFDO0lBRTNDLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztJQUVyQyxTQUFzQixJQUFJLENBQUMsSUFBSTs7WUFDN0IsSUFBSSxJQUFBLHdCQUFXLEVBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3JCLE1BQU0sSUFBQSwwQkFBYSxFQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ2xDO2lCQUFNO2dCQUNMLE9BQU8sQ0FBQSxNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDeEM7WUFDRCxPQUFPLENBQUMsQ0FBQztRQUNYLENBQUM7S0FBQTtJQVBELG9CQU9DO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBZ0Isa0JBQUssQ0FBQyxDQUFDO0lBRXRE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QUMsQ0FBQztZQUNoRixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDdEYsT0FBTyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxLQUFLLGtCQUFrQixFQUFFLENBQUM7UUFDN0YsQ0FBQztJQUNILENBQUM7SUEvRkQsa0ZBK0ZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHtBbmd1bGFyQ29tcGlsZXJPcHRpb25zLCBDb21waWxlckhvc3QgYXMgTmdDb21waWxlckhvc3QsIFRzRW1pdENhbGxiYWNrLCBQcm9ncmFtLCBDb21waWxlck9wdGlvbnN9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQge0JhemVsT3B0aW9ucywgQ2FjaGVkRmlsZUxvYWRlciwgQ29tcGlsZXJIb3N0LCBjb25zdHJ1Y3RNYW5pZmVzdCwgZGVidWcsIEZpbGVDYWNoZSwgRmlsZUxvYWRlciwgcGFyc2VUc2NvbmZpZywgcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoLCBydW5Bc1dvcmtlciwgcnVuV29ya2VyTG9vcCwgVW5jYWNoZWRGaWxlTG9hZGVyfSBmcm9tICdAYmF6ZWwvdHlwZXNjcmlwdCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHNpY2tsZSBmcm9tICd0c2lja2xlJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7cGF0aFRvRmlsZVVSTH0gZnJvbSAndXJsJztcblxudHlwZSBDb21waWxlckNsaU1vZHVsZSA9XG4gICAgdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJykmdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3ByaXZhdGUvYmF6ZWwnKTtcblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gdGhlIHByZXZpb3VzbHkgbG9hZGVkIGBjb21waWxlci1jbGlgIG1vZHVsZSBleHBvcnRzLiBXZSBjYWNoZSB0aGUgZXhwb3J0c1xuICogYXMgYG5nYy13cmFwcGVkYCBjYW4gcnVuIGFzIHBhcnQgb2YgYSB3b3JrZXIgd2hlcmUgdGhlIEFuZ3VsYXIgY29tcGlsZXIgc2hvdWxkIG5vdCBiZVxuICogcmVzb2x2ZWQgdGhyb3VnaCBhIGR5bmFtaWMgaW1wb3J0IGZvciBldmVyeSBidWlsZC5cbiAqL1xubGV0IF9jYWNoZWRDb21waWxlckNsaU1vZHVsZTogQ29tcGlsZXJDbGlNb2R1bGV8bnVsbCA9IG51bGw7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXdhaXQgcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbi8qKlxuICogTG9hZHMgYSBtb2R1bGUgdGhhdCBjYW4gZWl0aGVyIGJlIENvbW1vbkpTIG9yIGFuIEVTTW9kdWxlLiBUaGlzIGlzIGRvbmVcbiAqIGFzIGludGVyb3Agd2l0aCB0aGUgY3VycmVudCBkZXZtb2RlIENvbW1vbkpTIGFuZCBwcm9kbW9kZSBFU00gb3V0cHV0LlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkTW9kdWxlSW50ZXJvcDxUPihtb2R1bGVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPFQ+IHtcbiAgLy8gTm90ZTogVGhpcyBhc3N1bWVzIHRoYXQgdGhlcmUgYXJlIG5vIGNvbmRpdGlvbmFsIGV4cG9ydHMgc3dpdGNoaW5nIGJldHdlZW4gYGltcG9ydGBcbiAgLy8gb3IgYHJlcXVpcmVgLiBXZSBjYW5ub3QgZnVsbHkgcmVseSBvbiB0aGUgZHluYW1pYyBpbXBvcnQgZXhwcmVzc2lvbiBoZXJlIGJlY2F1c2UgdGhlXG4gIC8vIEJhemVsIE5vZGVKUyBydWxlcyBkbyBub3QgcGF0Y2ggdGhlIGBpbXBvcnRgIE5vZGVKUyBtb2R1bGUgcmVzb2x1dGlvbiwgYW5kIHRoaXMgd291bGRcbiAgLy8gbWFrZSBuZ2Mtd3JhcHBlZCBkZXBlbmRlbnQgb24gdGhlIGxpbmtlci4gVGhlIGxpbmtlciBpcyBub3QgZW5hYmxlZCB3aGVuIHRoZSBgbmdjLXdyYXBwZWRgXG4gIC8vIGJpbmFyeSBpcyBzaGlwcGVkIGluIHRoZSBOUE0gcGFja2FnZSBhbmQgaXMgbm90IGF2YWlsYWJsZSBpbiBHb29nbGUzIGVpdGhlci5cbiAgY29uc3QgcmVzb2x2ZWRVcmwgPSBwYXRoVG9GaWxlVVJMKHJlcXVpcmUucmVzb2x2ZShtb2R1bGVOYW1lKSk7XG4gIGNvbnN0IGV4cG9ydHM6IFBhcnRpYWw8VD4me2RlZmF1bHQ/OiBUfSA9XG4gICAgICBhd2FpdCBuZXcgRnVuY3Rpb24oJ20nLCBgcmV0dXJuIGltcG9ydChtKTtgKShyZXNvbHZlZFVybCk7XG4gIHJldHVybiBleHBvcnRzLmRlZmF1bHQgPz8gZXhwb3J0cyBhcyBUO1xufVxuXG4vKipcbiAqIEZldGNoZXMgdGhlIEFuZ3VsYXIgY29tcGlsZXIgQ0xJIG1vZHVsZSBkeW5hbWljYWxseSwgYWxsb3dpbmcgZm9yIGFuIEVTTVxuICogdmFyaWFudCBvZiB0aGUgY29tcGlsZXIuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZldGNoQ29tcGlsZXJDbGlNb2R1bGUoKTogUHJvbWlzZTxDb21waWxlckNsaU1vZHVsZT4ge1xuICBpZiAoX2NhY2hlZENvbXBpbGVyQ2xpTW9kdWxlICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIF9jYWNoZWRDb21waWxlckNsaU1vZHVsZTtcbiAgfVxuXG4gIC8vIE5vdGU6IFdlIGxvYWQgdGhlIGNvbXBpbGVyLWNsaSBwYWNrYWdlIGR5bmFtaWNhbGx5IHVzaW5nIGBsb2FkTW9kdWxlSW50ZXJvcGAgYXNcbiAgLy8gdGhpcyBzY3JpcHQgcnVucyBhcyBDb21tb25KUyBtb2R1bGUgYnV0IHRoZSBjb21waWxlci1jbGkgY291bGQgYmUgYnVpbHQgYXMgc3RyaWN0IEVTTVxuICAvLyBwYWNrYWdlLiBVbmZvcnR1bmF0ZWx5IHdlIGhhdmUgYSBtaXggb2YgQ29tbW9uSlMgYW5kIEVTTSBvdXRwdXQgaGVyZSBiZWNhdXNlIHRoZSBkZXZtb2RlXG4gIC8vIG91dHB1dCBpcyBzdGlsbCB1c2luZyBDb21tb25KUyBhbmQgdGhpcyBpcyBwcmltYXJpbHkgdXNlZCBmb3IgdGVzdGluZy4gQWxzbyBpbnNpZGUgRzMsXG4gIC8vIHRoZSBkZXZtb2RlIG91dHB1dCB3aWxsIHJlbWFpbiBDb21tb25KUyByZWdhcmRsZXNzIGZvciBub3cuXG4gIC8vIFRPRE86IEZpeCB0aGlzIHVwIG9uY2UgZGV2bW9kZSBhbmQgcHJvZG1vZGUgYXJlIGNvbWJpbmVkIGFuZCB3ZSB1c2UgRVNNIGV2ZXJ5d2hlcmUuXG4gIGNvbnN0IGNvbXBpbGVyRXhwb3J0cyA9XG4gICAgICBhd2FpdCBsb2FkTW9kdWxlSW50ZXJvcDx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuICBjb25zdCBjb21waWxlclByaXZhdGVFeHBvcnRzID1cbiAgICAgIGF3YWl0IGxvYWRNb2R1bGVJbnRlcm9wPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9wcml2YXRlL2JhemVsJyk+KFxuICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCcpO1xuICByZXR1cm4gX2NhY2hlZENvbXBpbGVyQ2xpTW9kdWxlID0gey4uLmNvbXBpbGVyRXhwb3J0cywgLi4uY29tcGlsZXJQcml2YXRlRXhwb3J0c307XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChcbiAgICBhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSB7XG4gICAgYXJncy5zaGlmdCgpO1xuICB9XG5cbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcbiAgY29uc3QgbmcgPSBhd2FpdCBmZXRjaENvbXBpbGVyQ2xpTW9kdWxlKCk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICBdKTtcblxuICBjb25zdCB1c2VyT3ZlcnJpZGVzID0gT2JqZWN0LmVudHJpZXModXNlck9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoW2tleV0pID0+IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcy5oYXMoa2V5KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVkdWNlKChvYmosIFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCB7fSk7XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBBbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ10sXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICAgIG5nLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVQYXRoOiBzdHJpbmcsIHJvb3REaXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmICghZmlsZVBhdGgpIHJldHVybiBmaWxlUGF0aDtcbiAgLy8gTkI6IHRoZSByb290RGlycyBzaG91bGQgaGF2ZSBiZWVuIHNvcnRlZCBsb25nZXN0LWZpcnN0XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcm9vdERpcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBkaXIgPSByb290RGlyc1tpXTtcbiAgICBjb25zdCByZWwgPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGRpciwgZmlsZVBhdGgpO1xuICAgIGlmIChyZWwuaW5kZXhPZignLicpICE9IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdCxcbiAgbmcsXG59OiB7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbD86IGJvb2xlYW4sXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU/OiBib29sZWFuLCBjb21waWxlck9wdHM6IENvbXBpbGVyT3B0aW9ucywgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsXG4gIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbiAgICAgICAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgICAgIGZpbGVzOiBzdHJpbmdbXSxcbiAgICAgICAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXSxcbiAgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogUHJvZ3JhbSkgPT4gcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdLFxuICBiYXplbEhvc3Q/OiBDb21waWxlckhvc3QsIG5nOiBDb21waWxlckNsaU1vZHVsZSxcbn0pOiB7ZGlhZ25vc3RpY3M6IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXSwgcHJvZ3JhbTogUHJvZ3JhbX0ge1xuICBsZXQgZmlsZUxvYWRlcjogRmlsZUxvYWRlcjtcblxuICBpZiAoYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBtYXhDYWNoZVNpemVCeXRlcyA9IGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAqICgxIDw8IDIwKTtcbiAgICBmaWxlQ2FjaGUuc2V0TWF4Q2FjaGVTaXplKG1heENhY2hlU2l6ZUJ5dGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlQ2FjaGUucmVzZXRNYXhDYWNoZVNpemUoKTtcbiAgfVxuXG4gIGlmIChpbnB1dHMpIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IENhY2hlZEZpbGVMb2FkZXIoZmlsZUNhY2hlKTtcbiAgICAvLyBSZXNvbHZlIHRoZSBpbnB1dHMgdG8gYWJzb2x1dGUgcGF0aHMgdG8gbWF0Y2ggVHlwZVNjcmlwdCBpbnRlcm5hbHNcbiAgICBjb25zdCByZXNvbHZlZElucHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMoaW5wdXRzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0S2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qga2V5ID0gaW5wdXRLZXlzW2ldO1xuICAgICAgcmVzb2x2ZWRJbnB1dHMuc2V0KHJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBVbmNhY2hlZEZpbGVMb2FkZXIoKTtcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gISFjb21waWxlck9wdHMuZW5hYmxlSXZ5O1xuICBpZiAoIWNvbXBpbGVyT3B0cy5yb290RGlycykge1xuICAgIHRocm93IG5ldyBFcnJvcigncm9vdERpcnMgaXMgbm90IHNldCEnKTtcbiAgfVxuICBjb25zdCBiYXplbEJpbiA9IGNvbXBpbGVyT3B0cy5yb290RGlycy5maW5kKHJvb3REaXIgPT4gQkFaRUxfQklOLnRlc3Qocm9vdERpcikpO1xuICBpZiAoIWJhemVsQmluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGJhemVsIGJpbiBpbiB0aGUgcm9vdERpcnM6ICR7Y29tcGlsZXJPcHRzLnJvb3REaXJzfWApO1xuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRPdXRzU2V0ID0gbmV3IFNldChleHBlY3RlZE91dHMubWFwKHAgPT4gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChwKSkpO1xuXG4gIGNvbnN0IG9yaWdpbmFsV3JpdGVGaWxlID0gdHNIb3N0LndyaXRlRmlsZS5iaW5kKHRzSG9zdCk7XG4gIHRzSG9zdC53cml0ZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLCBzb3VyY2VGaWxlcz86IHRzLlNvdXJjZUZpbGVbXSkgPT4ge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9XG4gICAgICAgICAgICByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtjb21waWxlck9wdHMucm9vdERpcl0pO1xuICAgICAgICBpZiAoZXhwZWN0ZWRPdXRzU2V0LmhhcyhyZWxhdGl2ZSkpIHtcbiAgICAgICAgICBleHBlY3RlZE91dHNTZXQuZGVsZXRlKHJlbGF0aXZlKTtcbiAgICAgICAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgY29udGVudCwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QgPSBPYmplY3QuY3JlYXRlKHRzSG9zdCk7XG4gIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIoXG4gICAgICBtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcsXG4gICAgICBjb21waWxlck9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyk6IHRzLlJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyB7XG4gICAgcmV0dXJuIHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICBtb2R1bGVOYW1lLCBjb250YWluaW5nRmlsZSwgY29tcGlsZXJPcHRpb25zLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0KTtcbiAgfVxuXG4gIGlmICghYmF6ZWxIb3N0KSB7XG4gICAgYmF6ZWxIb3N0ID0gbmV3IENvbXBpbGVySG9zdChcbiAgICAgICAgZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcik7XG4gIH1cblxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICAgIGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgLy8gVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2Ygc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nIGNoZWNrcyB3aGV0aGVyIGBmaWxlTmFtZWAgaXMgcGFydCBvZlxuICAgICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAgIC8vIHNoaW1zIGZvciBvcmlnaW5hbCAudHMgZmlsZXMgaW4gdGhlIHByb2dyYW0gc2hvdWxkIGJlIHRyZWF0ZWQgaWRlbnRpY2FsbHkuIFRodXMsIHN0cmlwIHRoZVxuICAgICAgLy8gJy5uZ2ZhY3RvcnknIG9yICcubmdzdW1tYXJ5JyBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBhd2F5IGJlZm9yZSBjYWxsaW5nIHRoZSBkZWxlZ2F0ZS5cbiAgICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICAgIH07XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0LCBkaXNhYmxlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybWluZyBpbiB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0LlxuICAvLyBUaGUgQW5ndWxhciBjb21waWxlcnMgaGF2ZSB0aGVpciBvd24gbG9naWMgZm9yIGRlY29yYXRvciBwcm9jZXNzaW5nIGFuZCB3ZSB3b3VsZG4ndFxuICAvLyB3YW50IHRzaWNrbGUgdG8gaW50ZXJmZXJlIHdpdGggdGhhdC5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlKSB7XG4gICAgaWYgKGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lID09PSAnZ29vZ2xlMycpIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IHRydWU7XG4gICAgICAvLyBFbmFibGUgdGhlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybSBpbiBnb29nbGUzIHdpdGggSXZ5IG1vZGUgZW5hYmxlZC4gVGhlIHRzaWNrbGVcbiAgICAgIC8vIGRlY29yYXRvciB0cmFuc2Zvcm1hdGlvbiBpcyBzdGlsbCBuZWVkZWQuIFRoaXMgbWlnaHQgYmUgYmVjYXVzZSBvZiBjdXN0b20gZGVjb3JhdG9yc1xuICAgICAgLy8gd2l0aCB0aGUgYEBBbm5vdGF0aW9uYCBKU0RvYyB0aGF0IHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0uXG4gICAgICAvLyBUT0RPOiBGaWd1cmUgb3V0IHdoeSB0aGlzIGlzIG5lZWRlZCBpbiBnMyBhbmQgaG93IHdlIGNhbiBpbXByb3ZlIHRoaXMuIEZXLTIyMjVcbiAgICAgIGlmIChpc0luSXZ5TW9kZSkge1xuICAgICAgICBiYXplbEhvc3QudHJhbnNmb3JtRGVjb3JhdG9ycyA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXJgIEFuZ3VsYXIgY29tcGlsZXIgb3B0aW9uIGlzIG5vdCByZXNwZWN0ZWQgYnkgZGVmYXVsdFxuICAvLyBhcyBuZ2Mtd3JhcHBlZCBoYW5kbGVzIHRzaWNrbGUgZW1pdCBvbiBpdHMgb3duLiBUaGlzIG1lYW5zIHRoYXQgd2UgbmVlZCB0byB1cGRhdGVcbiAgLy8gdGhlIHRzaWNrbGUgY29tcGlsZXIgaG9zdCBiYXNlZCBvbiB0aGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBmbGFnLlxuICBpZiAoY29tcGlsZXJPcHRzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSB7XG4gICAgYmF6ZWxIb3N0LnRyYW5zZm9ybVR5cGVzVG9DbG9zdXJlID0gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IG9yaWdCYXplbEhvc3RGaWxlRXhpc3QgPSBiYXplbEhvc3QuZmlsZUV4aXN0cztcbiAgYmF6ZWxIb3N0LmZpbGVFeGlzdHMgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChOR0NfQVNTRVRTLnRlc3QoZmlsZU5hbWUpKSB7XG4gICAgICByZXR1cm4gdHNIb3N0LmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdEZpbGVFeGlzdC5jYWxsKGJhemVsSG9zdCwgZmlsZU5hbWUpO1xuICB9O1xuICBjb25zdCBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZSA9IGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlLmJpbmQoYmF6ZWxIb3N0KTtcbiAgYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGZsYXRNb2R1bGVPdXRQYXRoID1cbiAgICAgICAgcGF0aC5wb3NpeC5qb2luKGJhemVsT3B0cy5wYWNrYWdlLCBjb21waWxlck9wdHMuZmxhdE1vZHVsZU91dEZpbGUgKyAnLnRzJyk7XG5cbiAgICAvLyBUaGUgYnVuZGxlIGluZGV4IGZpbGUgaXMgc3ludGhlc2l6ZWQgaW4gYnVuZGxlX2luZGV4X2hvc3Qgc28gaXQncyBub3QgaW4gdGhlXG4gICAgLy8gY29tcGlsYXRpb25UYXJnZXRTcmMuXG4gICAgLy8gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGdpdmUgaXQgYW4gQU1EIG1vZHVsZSBuYW1lIGZvciBkZXZtb2RlLlxuICAgIC8vIFdlIGNhbid0IGVhc2lseSB0ZWxsIHdoaWNoIGZpbGUgaXMgdGhlIHN5bnRoZXRpYyBvbmUsIHNvIHdlIGJ1aWxkIHVwIHRoZSBwYXRoIHdlIGV4cGVjdFxuICAgIC8vIGl0IHRvIGhhdmUgYW5kIGNvbXBhcmUgYWdhaW5zdCB0aGF0LlxuICAgIGlmIChmaWxlTmFtZSA9PT0gcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCBmbGF0TW9kdWxlT3V0UGF0aCkpIHJldHVybiB0cnVlO1xuXG4gICAgLy8gQWxzbyBoYW5kbGUgdGhlIGNhc2UgdGhlIHRhcmdldCBpcyBpbiBhbiBleHRlcm5hbCByZXBvc2l0b3J5LlxuICAgIC8vIFB1bGwgdGhlIHdvcmtzcGFjZSBuYW1lIGZyb20gdGhlIHRhcmdldCB3aGljaCBpcyBmb3JtYXR0ZWQgYXMgYEB3a3NwLy9wYWNrYWdlOnRhcmdldGBcbiAgICAvLyBpZiBpdCB0aGUgdGFyZ2V0IGlzIGZyb20gYW4gZXh0ZXJuYWwgd29ya3NwYWNlLiBJZiB0aGUgdGFyZ2V0IGlzIGZyb20gdGhlIGxvY2FsXG4gICAgLy8gd29ya3NwYWNlIHRoZW4gaXQgd2lsbCBiZSBmb3JtYXR0ZWQgYXMgYC8vcGFja2FnZTp0YXJnZXRgLlxuICAgIGNvbnN0IHRhcmdldFdvcmtzcGFjZSA9IGJhemVsT3B0cy50YXJnZXQuc3BsaXQoJy8nKVswXS5yZXBsYWNlKC9eQC8sICcnKTtcblxuICAgIGlmICh0YXJnZXRXb3Jrc3BhY2UgJiZcbiAgICAgICAgZmlsZU5hbWUgPT09XG4gICAgICAgICAgICBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsICdleHRlcm5hbCcsIHRhcmdldFdvcmtzcGFjZSwgZmxhdE1vZHVsZU91dFBhdGgpKVxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUoZmlsZU5hbWUpIHx8IE5HQ19HRU5fRklMRVMudGVzdChmaWxlTmFtZSk7XG4gIH07XG5cbiAgY29uc3QgbmdIb3N0ID0gbmcuY3JlYXRlQ29tcGlsZXJIb3N0KHtvcHRpb25zOiBjb21waWxlck9wdHMsIHRzSG9zdDogYmF6ZWxIb3N0fSk7XG4gIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICAgICAgbmdIb3N0LCBjb21waWxlck9wdHMsIGJhemVsT3B0cywgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSk7XG5cbiAgbmdIb3N0LnRvU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ1NyY0ZpbGVOYW1lOiBzdHJpbmcpID0+IHBhdGgucG9zaXguam9pbihcbiAgICAgIGJhemVsT3B0cy53b3Jrc3BhY2VOYW1lLFxuICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVOYW1lLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJykpO1xuICBpZiAoYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsKSB7XG4gICAgLy8gTm90ZTogVGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gd291bGQgd29yayBhcyB3ZWxsLFxuICAgIC8vIGJ1dCB3ZSBjYW4gYmUgZmFzdGVyIGFzIHdlIGtub3cgaG93IGB0b1N1bW1hcnlGaWxlTmFtZWAgd29ya3MuXG4gICAgLy8gTm90ZTogV2UgY2FuJ3QgZG8gdGhpcyBpZiBzb21lIGRlcHMgaGF2ZSBiZWVuIGNvbXBpbGVkIHdpdGggdGhlIGNvbW1hbmQgbGluZSxcbiAgICAvLyBhcyB0aGF0IGhhcyBhIGRpZmZlcmVudCBpbXBsZW1lbnRhdGlvbiBvZiBmcm9tU3VtbWFyeUZpbGVOYW1lIC8gdG9TdW1tYXJ5RmlsZU5hbWVcbiAgICBuZ0hvc3QuZnJvbVN1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdMaWJGaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSZWxhdGl2ZSA9IGZpbGVOYW1lLnNwbGl0KCcvJykuc3BsaWNlKDEpLmpvaW4oJy8nKTtcbiAgICAgIHJldHVybiByZXNvbHZlTm9ybWFsaXplZFBhdGgoYmF6ZWxCaW4sIHdvcmtzcGFjZVJlbGF0aXZlKSArICcuZC50cyc7XG4gICAgfTtcbiAgfVxuICAvLyBQYXRjaCBhIHByb3BlcnR5IG9uIHRoZSBuZ0hvc3QgdGhhdCBhbGxvd3MgdGhlIHJlc291cmNlTmFtZVRvTW9kdWxlTmFtZSBmdW5jdGlvbiB0b1xuICAvLyByZXBvcnQgYmV0dGVyIGVycm9ycy5cbiAgKG5nSG9zdCBhcyBhbnkpLnJlcG9ydE1pc3NpbmdSZXNvdXJjZSA9IChyZXNvdXJjZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxcbkFzc2V0IG5vdCBmb3VuZDpcXG4gICR7cmVzb3VyY2VOYW1lfWApO1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoZWNrIHRoYXQgaXRcXCdzIGluY2x1ZGVkIGluIHRoZSBgYXNzZXRzYCBhdHRyaWJ1dGUgb2YgdGhlIGBuZ19tb2R1bGVgIHJ1bGUuXFxuJyk7XG4gIH07XG5cbiAgY29uc3QgZW1pdENhbGxiYWNrOiBUc0VtaXRDYWxsYmFjayA9ICh7XG4gICAgcHJvZ3JhbSxcbiAgICB0YXJnZXRTb3VyY2VGaWxlLFxuICAgIHdyaXRlRmlsZSxcbiAgICBjYW5jZWxsYXRpb25Ub2tlbixcbiAgICBlbWl0T25seUR0c0ZpbGVzLFxuICAgIGN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICB9KSA9PlxuICAgICAgdHNpY2tsZS5lbWl0V2l0aFRzaWNrbGUoXG4gICAgICAgICAgcHJvZ3JhbSwgYmF6ZWxIb3N0LCBiYXplbEhvc3QsIGNvbXBpbGVyT3B0cywgdGFyZ2V0U291cmNlRmlsZSwgd3JpdGVGaWxlLFxuICAgICAgICAgIGNhbmNlbGxhdGlvblRva2VuLCBlbWl0T25seUR0c0ZpbGVzLCB7XG4gICAgICAgICAgICBiZWZvcmVUczogY3VzdG9tVHJhbnNmb3JtZXJzLmJlZm9yZSxcbiAgICAgICAgICAgIGFmdGVyVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlcixcbiAgICAgICAgICAgIGFmdGVyRGVjbGFyYXRpb25zOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXJEZWNsYXJhdGlvbnMsXG4gICAgICAgICAgfSk7XG5cbiAgaWYgKCFnYXRoZXJEaWFnbm9zdGljcykge1xuICAgIGdhdGhlckRpYWdub3N0aWNzID0gKHByb2dyYW0pID0+XG4gICAgICAgIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShjb21waWxlck9wdHMsIGJhemVsT3B0cywgcHJvZ3JhbSwgbmcpO1xuICB9XG4gIGNvbnN0IHtkaWFnbm9zdGljcywgZW1pdFJlc3VsdCwgcHJvZ3JhbX0gPSBuZy5wZXJmb3JtQ29tcGlsYXRpb24oe1xuICAgIHJvb3ROYW1lczogZmlsZXMsXG4gICAgb3B0aW9uczogY29tcGlsZXJPcHRzLFxuICAgIGhvc3Q6IG5nSG9zdCxcbiAgICBlbWl0Q2FsbGJhY2ssXG4gICAgbWVyZ2VFbWl0UmVzdWx0c0NhbGxiYWNrOiB0c2lja2xlLm1lcmdlRW1pdFJlc3VsdHMsXG4gICAgZ2F0aGVyRGlhZ25vc3RpY3NcbiAgfSk7XG4gIGNvbnN0IHRzaWNrbGVFbWl0UmVzdWx0ID0gZW1pdFJlc3VsdCBhcyB0c2lja2xlLkVtaXRSZXN1bHQ7XG4gIGxldCBleHRlcm5zID0gJy8qKiBAZXh0ZXJucyAqL1xcbic7XG4gIGNvbnN0IGhhc0Vycm9yID0gZGlhZ25vc3RpY3Muc29tZSgoZGlhZykgPT4gZGlhZy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbiAgaWYgKCFoYXNFcnJvcikge1xuICAgIGlmIChiYXplbE9wdHMudHNpY2tsZUdlbmVyYXRlRXh0ZXJucykge1xuICAgICAgZXh0ZXJucyArPSB0c2lja2xlLmdldEdlbmVyYXRlZEV4dGVybnModHNpY2tsZUVtaXRSZXN1bHQuZXh0ZXJucywgY29tcGlsZXJPcHRzLnJvb3REaXIhKTtcbiAgICB9XG4gICAgaWYgKGJhemVsT3B0cy5tYW5pZmVzdCkge1xuICAgICAgY29uc3QgbWFuaWZlc3QgPSBjb25zdHJ1Y3RNYW5pZmVzdCh0c2lja2xlRW1pdFJlc3VsdC5tb2R1bGVzTWFuaWZlc3QsIGJhemVsSG9zdCk7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy5tYW5pZmVzdCwgbWFuaWZlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIGNvbXBpbGF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseSwgcGVyZm9ybUNvbXBpbGF0aW9uIHJldHVybnMgbm8gcHJvZ3JhbS5cbiAgLy8gTWFrZSBzdXJlIG5vdCB0byBjcmFzaCBidXQgcmVwb3J0IHRoZSBkaWFnbm9zdGljcy5cbiAgaWYgKCFwcm9ncmFtKSByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcblxuICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCkge1xuICAgIC8vIE5vdGU6IHdoZW4gdHNpY2tsZUV4dGVybnNQYXRoIGlzIHByb3ZpZGVkLCB3ZSBhbHdheXMgd3JpdGUgYSBmaWxlIGFzIGFcbiAgICAvLyBtYXJrZXIgdGhhdCBjb21waWxhdGlvbiBzdWNjZWVkZWQsIGV2ZW4gaWYgaXQncyBlbXB0eSAoanVzdCBjb250YWluaW5nIGFuXG4gICAgLy8gQGV4dGVybnMpLlxuICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLnRzaWNrbGVFeHRlcm5zUGF0aCwgZXh0ZXJucyk7XG4gIH1cblxuICAvLyBUaGVyZSBtaWdodCBiZSBzb21lIGV4cGVjdGVkIG91dHB1dCBmaWxlcyB0aGF0IGFyZSBub3Qgd3JpdHRlbiBieSB0aGVcbiAgLy8gY29tcGlsZXIuIEluIHRoaXMgY2FzZSwganVzdCB3cml0ZSBhbiBlbXB0eSBmaWxlLlxuICBmb3IgKGNvbnN0IGZpbGVOYW1lIG9mIGV4cGVjdGVkT3V0c1NldCkge1xuICAgIG9yaWdpbmFsV3JpdGVGaWxlKGZpbGVOYW1lLCAnJywgZmFsc2UpO1xuICB9XG5cbiAgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG59XG5cbmZ1bmN0aW9uIGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsIHNmOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhTkdDX0dFTl9GSUxFUy50ZXN0KHNmLmZpbGVOYW1lKSAmJlxuICAgICAgKGJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmRleE9mKHNmLmZpbGVOYW1lKSAhPT0gLTEpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9Gb3J3YXJkU2xhc2hQYXRoKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZmlsZVBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xufVxuXG5mdW5jdGlvbiBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoXG4gICAgb3B0aW9uczogQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgbmdQcm9ncmFtOiBQcm9ncmFtLFxuICAgIG5nOiBDb21waWxlckNsaU1vZHVsZSk6IHRzLkRpYWdub3N0aWNbXSB7XG4gIGNvbnN0IHRzUHJvZ3JhbSA9IG5nUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcblxuICAvLyBGb3IgdGhlIEl2eSBjb21waWxlciwgdHJhY2sgdGhlIGFtb3VudCBvZiB0aW1lIHNwZW50IGZldGNoaW5nIFR5cGVTY3JpcHQgZGlhZ25vc3RpY3MuXG4gIGxldCBwcmV2aW91c1BoYXNlID0gbmcuUGVyZlBoYXNlLlVuYWNjb3VudGVkO1xuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgcHJldmlvdXNQaGFzZSA9IG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UobmcuUGVyZlBoYXNlLlR5cGVTY3JpcHREaWFnbm9zdGljcyk7XG4gIH1cbiAgY29uc3QgZGlhZ25vc3RpY3M6IHRzLkRpYWdub3N0aWNbXSA9IFtdO1xuICAvLyBUaGVzZSBjaGVja3MgbWlycm9yIHRzLmdldFByZUVtaXREaWFnbm9zdGljcywgd2l0aCB0aGUgaW1wb3J0YW50XG4gIC8vIGV4Y2VwdGlvbiBvZiBhdm9pZGluZyBiLzMwNzA4MjQwLCB3aGljaCBpcyB0aGF0IGlmIHlvdSBjYWxsXG4gIC8vIHByb2dyYW0uZ2V0RGVjbGFyYXRpb25EaWFnbm9zdGljcygpIGl0IHNvbWVob3cgY29ycnVwdHMgdGhlIGVtaXQuXG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpKTtcbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKSk7XG4gIGNvbnN0IHByb2dyYW1GaWxlcyA9IHRzUHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpLmZpbHRlcihmID0+IGlzQ29tcGlsYXRpb25UYXJnZXQoYmF6ZWxPcHRzLCBmKSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvZ3JhbUZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qgc2YgPSBwcm9ncmFtRmlsZXNbaV07XG4gICAgLy8gTm90ZTogV2Ugb25seSBnZXQgdGhlIGRpYWdub3N0aWNzIGZvciBpbmRpdmlkdWFsIGZpbGVzXG4gICAgLy8gdG8gZS5nLiBub3QgY2hlY2sgbGlicmFyaWVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNmKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzZikpO1xuICB9XG5cbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIG5nUHJvZ3JhbS5jb21waWxlci5wZXJmUmVjb3JkZXIucGhhc2UocHJldmlvdXNQaGFzZSk7XG4gIH1cblxuICBpZiAoIWRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIC8vIG9ubHkgZ2F0aGVyIHRoZSBhbmd1bGFyIGRpYWdub3N0aWNzIGlmIHdlIGhhdmUgbm8gZGlhZ25vc3RpY3NcbiAgICAvLyBpbiBhbnkgb3RoZXIgZmlsZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTdHJ1Y3R1cmFsRGlhZ25vc3RpY3MoKSk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi5uZ1Byb2dyYW0uZ2V0TmdTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG4gIHJldHVybiBkaWFnbm9zdGljcztcbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIG1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKS50aGVuKGV4aXRDb2RlID0+IHByb2Nlc3MuZXhpdENvZGUgPSBleGl0Q29kZSkuY2F0Y2goZSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihlKTtcbiAgICBwcm9jZXNzLmV4aXRDb2RlID0gMTtcbiAgfSk7XG59XG5cbi8qKlxuICogQWRkcyBzdXBwb3J0IGZvciB0aGUgb3B0aW9uYWwgYGZpbGVOYW1lVG9Nb2R1bGVOYW1lYCBvcGVyYXRpb24gdG8gYSBnaXZlbiBgbmcuQ29tcGlsZXJIb3N0YC5cbiAqXG4gKiBUaGlzIGlzIHVzZWQgd2l0aGluIGBuZ2Mtd3JhcHBlZGAgYW5kIHRoZSBCYXplbCBjb21waWxhdGlvbiBmbG93LCBidXQgaXMgZXhwb3J0ZWQgaGVyZSB0byBhbGxvd1xuICogZm9yIG90aGVyIGNvbnN1bWVycyBvZiB0aGUgY29tcGlsZXIgdG8gYWNjZXNzIHRoaXMgc2FtZSBsb2dpYy4gRm9yIGV4YW1wbGUsIHRoZSB4aTE4biBvcGVyYXRpb25cbiAqIGluIGczIGNvbmZpZ3VyZXMgaXRzIG93biBgbmcuQ29tcGlsZXJIb3N0YCB3aGljaCBhbHNvIHJlcXVpcmVzIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgdG8gd29ya1xuICogY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgbmdIb3N0OiBOZ0NvbXBpbGVySG9zdCwgY29tcGlsZXJPcHRzOiBDb21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIG5nSG9zdC5maWxlTmFtZVRvTW9kdWxlTmFtZSA9IChpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNhY2hlS2V5ID0gYCR7aW1wb3J0ZWRGaWxlUGF0aH06JHtjb250YWluaW5nRmlsZVBhdGh9YDtcbiAgICAvLyBNZW1vaXplIHRoaXMgbG9va3VwIHRvIGF2b2lkIGV4cGVuc2l2ZSByZS1wYXJzZXMgb2YgdGhlIHNhbWUgZmlsZVxuICAgIC8vIFdoZW4gcnVuIGFzIGEgd29ya2VyLCB0aGUgYWN0dWFsIHRzLlNvdXJjZUZpbGUgaXMgY2FjaGVkXG4gICAgLy8gYnV0IHdoZW4gd2UgZG9uJ3QgcnVuIGFzIGEgd29ya2VyLCB0aGVyZSBpcyBubyBjYWNoZS5cbiAgICAvLyBGb3Igb25lIGV4YW1wbGUgdGFyZ2V0IGluIGczLCB3ZSBzYXcgYSBjYWNoZSBoaXQgcmF0ZSBvZiA3NTkwLzc2OTVcbiAgICBpZiAoZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5oYXMoY2FjaGVLZXkpKSB7XG4gICAgICByZXR1cm4gZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5nZXQoY2FjaGVLZXkpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgsIGNvbnRhaW5pbmdGaWxlUGF0aCk7XG4gICAgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5zZXQoY2FjaGVLZXksIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBmdW5jdGlvbiBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCByZWxhdGl2ZVRhcmdldFBhdGggPVxuICAgICAgICByZWxhdGl2ZVRvUm9vdERpcnMoaW1wb3J0ZWRGaWxlUGF0aCwgY29tcGlsZXJPcHRzLnJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpO1xuICAgIGNvbnN0IG1hbmlmZXN0VGFyZ2V0UGF0aCA9IGAke2JhemVsT3B0cy53b3Jrc3BhY2VOYW1lfS8ke3JlbGF0aXZlVGFyZ2V0UGF0aH1gO1xuICAgIGlmICh1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cblxuICAgIC8vIFVubGVzcyBtYW5pZmVzdCBwYXRocyBhcmUgZXhwbGljaXRseSBlbmZvcmNlZCwgd2UgaW5pdGlhbGx5IGNoZWNrIGlmIGEgbW9kdWxlIG5hbWUgaXNcbiAgICAvLyBzZXQgZm9yIHRoZSBnaXZlbiBzb3VyY2UgZmlsZS4gVGhlIGNvbXBpbGVyIGhvc3QgZnJvbSBgQGJhemVsL3R5cGVzY3JpcHRgIHNldHMgc291cmNlXG4gICAgLy8gZmlsZSBtb2R1bGUgbmFtZXMgaWYgdGhlIGNvbXBpbGF0aW9uIHRhcmdldHMgZWl0aGVyIFVNRCBvciBBTUQuIFRvIGVuc3VyZSB0aGF0IHRoZSBBTURcbiAgICAvLyBtb2R1bGUgbmFtZXMgbWF0Y2gsIHdlIGZpcnN0IGNvbnNpZGVyIHRob3NlLlxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gbmdIb3N0LmdldFNvdXJjZUZpbGUoaW1wb3J0ZWRGaWxlUGF0aCwgdHMuU2NyaXB0VGFyZ2V0LkxhdGVzdCk7XG4gICAgICBpZiAoc291cmNlRmlsZSAmJiBzb3VyY2VGaWxlLm1vZHVsZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUZpbGUubW9kdWxlTmFtZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgcGFyc2UgZXJyb3IuIElnbm9yZSB0aGlzIGNhc2UgYW5kIGNvbnRpbnVlIG9udG8gdGhlXG4gICAgICAvLyBvdGhlciBtZXRob2RzIG9mIHJlc29sdmluZyB0aGUgbW9kdWxlIGJlbG93LlxuICAgIH1cblxuICAgIC8vIEl0IGNhbiBoYXBwZW4gdGhhdCB0aGUgVmlld0VuZ2luZSBjb21waWxlciBuZWVkcyB0byB3cml0ZSBhbiBpbXBvcnQgaW4gYSBmYWN0b3J5IGZpbGUsXG4gICAgLy8gYW5kIGlzIHVzaW5nIGFuIG5nc3VtbWFyeSBmaWxlIHRvIGdldCB0aGUgc3ltYm9scy5cbiAgICAvLyBUaGUgbmdzdW1tYXJ5IGNvbWVzIGZyb20gYW4gdXBzdHJlYW0gbmdfbW9kdWxlIHJ1bGUuXG4gICAgLy8gVGhlIHVwc3RyZWFtIHJ1bGUgYmFzZWQgaXRzIGltcG9ydHMgb24gbmdzdW1tYXJ5IGZpbGUgd2hpY2ggd2FzIGdlbmVyYXRlZCBmcm9tIGFcbiAgICAvLyBtZXRhZGF0YS5qc29uIGZpbGUgdGhhdCB3YXMgcHVibGlzaGVkIHRvIG5wbSBpbiBhbiBBbmd1bGFyIGxpYnJhcnkuXG4gICAgLy8gSG93ZXZlciwgdGhlIG5nc3VtbWFyeSBkb2Vzbid0IHByb3BhZ2F0ZSB0aGUgJ2ltcG9ydEFzJyBmcm9tIHRoZSBvcmlnaW5hbCBtZXRhZGF0YS5qc29uXG4gICAgLy8gc28gd2Ugd291bGQgbm9ybWFsbHkgbm90IGJlIGFibGUgdG8gc3VwcGx5IHRoZSBjb3JyZWN0IG1vZHVsZSBuYW1lIGZvciBpdC5cbiAgICAvLyBGb3IgZXhhbXBsZSwgaWYgdGhlIHJvb3REaXItcmVsYXRpdmUgZmlsZVBhdGggaXNcbiAgICAvLyAgbm9kZV9tb2R1bGVzL0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2xiYXIvdHlwaW5ncy9pbmRleFxuICAgIC8vIHdlIHdvdWxkIHN1cHBseSBhIG1vZHVsZSBuYW1lXG4gICAgLy8gIEBhbmd1bGFyL21hdGVyaWFsL3Rvb2xiYXIvdHlwaW5ncy9pbmRleFxuICAgIC8vIGJ1dCB0aGVyZSBpcyBubyBKYXZhU2NyaXB0IGZpbGUgdG8gbG9hZCBhdCB0aGlzIHBhdGguXG4gICAgLy8gVGhpcyBpcyBhIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzI5NDU0XG4gICAgaWYgKGltcG9ydGVkRmlsZVBhdGguaW5kZXhPZignbm9kZV9tb2R1bGVzJykgPj0gMCkge1xuICAgICAgY29uc3QgbWF5YmVNZXRhZGF0YUZpbGUgPSBpbXBvcnRlZEZpbGVQYXRoLnJlcGxhY2UoRVhULCAnJykgKyAnLm1ldGFkYXRhLmpzb24nO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobWF5YmVNZXRhZGF0YUZpbGUpKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSAoSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMobWF5YmVNZXRhZGF0YUZpbGUsIHtlbmNvZGluZzogJ3V0Zi04J30pKSBhcyB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltcG9ydEFzOiBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmltcG9ydEFzO1xuICAgICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICAgIHJldHVybiBtb2R1bGVOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLlVNRCB8fCBjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLkFNRCkgJiZcbiAgICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWUpIHtcbiAgICAgIHJldHVybiBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7ZmlsZU5hbWU6IGltcG9ydGVkRmlsZVBhdGh9IGFzIHRzLlNvdXJjZUZpbGUpO1xuICAgIH1cblxuICAgIC8vIElmIG5vIEFNRCBtb2R1bGUgbmFtZSBoYXMgYmVlbiBzZXQgZm9yIHRoZSBzb3VyY2UgZmlsZSBieSB0aGUgYEBiYXplbC90eXBlc2NyaXB0YCBjb21waWxlclxuICAgIC8vIGhvc3QsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgaXMgbm90IHBhcnQgb2YgYSBmbGF0IG1vZHVsZSBub2RlIG1vZHVsZSBwYWNrYWdlLCB3ZSB1c2UgdGhlXG4gICAgLy8gZm9sbG93aW5nIHJ1bGVzIChpbiBvcmRlcik6XG4gICAgLy8gICAgMS4gSWYgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBgbm9kZV9tb2R1bGVzL2AsIHdlIHVzZSB0aGUgcGFja2FnZSBtb2R1bGUgbmFtZS5cbiAgICAvLyAgICAyLiBJZiBubyBjb250YWluaW5nIGZpbGUgaXMgc3BlY2lmaWVkLCBvciB0aGUgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBhIGRpZmZlcmVudFxuICAgIC8vICAgICAgIGNvbXBpbGF0aW9uIHVuaXQsIHdlIHVzZSBhIEJhemVsIG1hbmlmZXN0IHBhdGguIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgcG9zc2libGVcbiAgICAvLyAgICAgICBzaW5jZSB3ZSBkb24ndCBoYXZlIGEgY29udGFpbmluZyBmaWxlLCBhbmQgdGhlIHRhcmdldCBmaWxlIGNvdWxkIGJlIGxvY2F0ZWQgaW4gdGhlXG4gICAgLy8gICAgICAgb3V0cHV0IGRpcmVjdG9yeSwgb3IgaW4gYW4gZXh0ZXJuYWwgQmF6ZWwgcmVwb3NpdG9yeS5cbiAgICAvLyAgICAzLiBJZiBib3RoIHJ1bGVzIGFib3ZlIGRpZG4ndCBtYXRjaCwgd2UgY29tcHV0ZSBhIHJlbGF0aXZlIHBhdGggYmV0d2VlbiB0aGUgc291cmNlIGZpbGVzXG4gICAgLy8gICAgICAgc2luY2UgdGhleSBhcmUgcGFydCBvZiB0aGUgc2FtZSBjb21waWxhdGlvbiB1bml0LlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCB3YW50IHRvIGFsd2F5cyB1c2UgKDIpIGJlY2F1c2UgaXQgY291bGQgbWVhbiB0aGF0IGNvbXBpbGF0aW9uIG91dHB1dHNcbiAgICAvLyBhcmUgYWx3YXlzIGxlYWtpbmcgQmF6ZWwtc3BlY2lmaWMgcGF0aHMsIGFuZCB0aGUgb3V0cHV0IGlzIG5vdCBzZWxmLWNvbnRhaW5lZC4gVGhpcyBjb3VsZFxuICAgIC8vIGJyZWFrIGBlc20yMDE1YCBvciBgZXNtNWAgb3V0cHV0IGZvciBBbmd1bGFyIHBhY2thZ2UgcmVsZWFzZSBvdXRwdXRcbiAgICAvLyBPbWl0IHRoZSBgbm9kZV9tb2R1bGVzYCBwcmVmaXggaWYgdGhlIG1vZHVsZSBuYW1lIG9mIGFuIE5QTSBwYWNrYWdlIGlzIHJlcXVlc3RlZC5cbiAgICBpZiAocmVsYXRpdmVUYXJnZXRQYXRoLnN0YXJ0c1dpdGgoTk9ERV9NT0RVTEVTKSkge1xuICAgICAgcmV0dXJuIHJlbGF0aXZlVGFyZ2V0UGF0aC5zbGljZShOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjb250YWluaW5nRmlsZVBhdGggPT0gbnVsbCB8fCAhYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluY2x1ZGVzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgICBjb25zdCBjb250YWluaW5nRmlsZURpciA9XG4gICAgICAgIHBhdGguZGlybmFtZShyZWxhdGl2ZVRvUm9vdERpcnMoY29udGFpbmluZ0ZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpKTtcbiAgICBjb25zdCByZWxhdGl2ZUltcG9ydFBhdGggPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGNvbnRhaW5pbmdGaWxlRGlyLCByZWxhdGl2ZVRhcmdldFBhdGgpO1xuICAgIHJldHVybiByZWxhdGl2ZUltcG9ydFBhdGguc3RhcnRzV2l0aCgnLicpID8gcmVsYXRpdmVJbXBvcnRQYXRoIDogYC4vJHtyZWxhdGl2ZUltcG9ydFBhdGh9YDtcbiAgfVxufVxuIl19