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
        define("@angular/bazel", ["require", "exports", "@bazel/concatjs/internal/tsc_wrapped", "fs", "path", "tsickle/src/tsickle", "typescript", "url"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.patchNgHostWithFileNameToModuleName = exports.compile = exports.relativeToRootDirs = exports.runOneBuild = exports.main = void 0;
    // `tsc-wrapped` helpers are not exposed in the primary `@bazel/concatjs` entry-point.
    // TODO: Update when https://github.com/bazelbuild/rules_nodejs/pull/3286 is available.
    const tsc_wrapped_1 = require("@bazel/concatjs/internal/tsc_wrapped");
    const fs = __importStar(require("fs"));
    const path = __importStar(require("path"));
    const tsickle = __importStar(require("tsickle/src/tsickle"));
    const typescript_1 = __importDefault(require("typescript"));
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
            if ((0, tsc_wrapped_1.runAsWorker)(args)) {
                yield (0, tsc_wrapped_1.runWorkerLoop)(runOneBuild);
            }
            else {
                return (yield runOneBuild(args)) ? 0 : 1;
            }
            return 0;
        });
    }
    exports.main = main;
    /** The one FileCache instance used in this process. */
    const fileCache = new tsc_wrapped_1.FileCache(tsc_wrapped_1.debug);
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
            const [parsedOptions, errors] = (0, tsc_wrapped_1.parseTsconfig)(project);
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
            const tsHost = typescript_1.default.createCompilerHost(compilerOpts, true);
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
            return diagnostics.every(d => d.category !== typescript_1.default.DiagnosticCategory.Error);
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
            fileLoader = new tsc_wrapped_1.CachedFileLoader(fileCache);
            // Resolve the inputs to absolute paths to match TypeScript internals
            const resolvedInputs = new Map();
            const inputKeys = Object.keys(inputs);
            for (let i = 0; i < inputKeys.length; i++) {
                const key = inputKeys[i];
                resolvedInputs.set((0, tsc_wrapped_1.resolveNormalizedPath)(key), inputs[key]);
            }
            fileCache.updateCache(resolvedInputs);
        }
        else {
            fileLoader = new tsc_wrapped_1.UncachedFileLoader();
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
            return typescript_1.default.resolveModuleName(moduleName, containingFile, compilerOptions, generatedFileModuleResolverHost);
        }
        if (!bazelHost) {
            bazelHost = new tsc_wrapped_1.CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader, generatedFileModuleResolver);
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
        if (!bazelOpts.es5Mode && !bazelOpts.devmode) {
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
                return (0, tsc_wrapped_1.resolveNormalizedPath)(bazelBin, workspaceRelative) + '.d.ts';
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
        const hasError = diagnostics.some((diag) => diag.category === typescript_1.default.DiagnosticCategory.Error);
        if (!hasError) {
            if (bazelOpts.tsickleGenerateExterns) {
                externs += tsickle.getGeneratedExterns(tsickleEmitResult.externs, compilerOpts.rootDir);
            }
            if (bazelOpts.manifest) {
                const manifest = (0, tsc_wrapped_1.constructManifest)(tsickleEmitResult.modulesManifest, bazelHost);
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
            // set for the given source file. The compiler host from `@bazel/concatjs` sets source
            // file module names if the compilation targets either UMD or AMD. To ensure that the AMD
            // module names match, we first consider those.
            try {
                const sourceFile = ngHost.getSourceFile(importedFilePath, typescript_1.default.ScriptTarget.Latest);
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
            if ((compilerOpts.module === typescript_1.default.ModuleKind.UMD || compilerOpts.module === typescript_1.default.ModuleKind.AMD) &&
                ngHost.amdModuleName) {
                return ngHost.amdModuleName({ fileName: importedFilePath });
            }
            // If no AMD module name has been set for the source file by the `@bazel/concatjs` compiler
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFFSCxzRkFBc0Y7SUFDdEYsdUZBQXVGO0lBQ3ZGLHNFQUFpUTtJQUdqUSx1Q0FBeUI7SUFDekIsMkNBQTZCO0lBQzdCLDZEQUFtQztJQUNuQyw0REFBNEI7SUFDNUIsNkJBQWtDO0lBVWxDOzs7O09BSUc7SUFDSCxJQUFJLHdCQUF3QixHQUEyQixJQUFJLENBQUM7SUFFNUQsTUFBTSxHQUFHLEdBQUcsa0NBQWtDLENBQUM7SUFDL0MsTUFBTSxhQUFhLEdBQUcsMERBQTBELENBQUM7SUFDakYsMkVBQTJFO0lBQzNFLG1CQUFtQjtJQUNuQixNQUFNLFVBQVUsR0FBRywrQkFBK0IsQ0FBQztJQUVuRCxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztJQUVwRCw0RUFBNEU7SUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7SUFFM0MsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0lBRXJDLFNBQXNCLElBQUksQ0FBQyxJQUFJOztZQUM3QixJQUFJLElBQUEseUJBQVcsRUFBQyxJQUFJLENBQUMsRUFBRTtnQkFDckIsTUFBTSxJQUFBLDJCQUFhLEVBQUMsV0FBVyxDQUFDLENBQUM7YUFDbEM7aUJBQU07Z0JBQ0wsT0FBTyxDQUFBLE1BQU0sV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUN4QztZQUNELE9BQU8sQ0FBQyxDQUFDO1FBQ1gsQ0FBQztLQUFBO0lBUEQsb0JBT0M7SUFFRCx1REFBdUQ7SUFDdkQsTUFBTSxTQUFTLEdBQUcsSUFBSSx1QkFBUyxDQUFnQixtQkFBSyxDQUFDLENBQUM7SUFFdEQ7OztPQUdHO0lBQ0gsU0FBZSxpQkFBaUIsQ0FBSSxVQUFrQjs7O1lBQ3BELHNGQUFzRjtZQUN0Rix1RkFBdUY7WUFDdkYsd0ZBQXdGO1lBQ3hGLDZGQUE2RjtZQUM3RiwrRUFBK0U7WUFDL0UsTUFBTSxXQUFXLEdBQUcsSUFBQSxtQkFBYSxFQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUMvRCxNQUFNLE9BQU8sR0FDVCxNQUFNLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzlELE9BQU8sTUFBQSxPQUFPLENBQUMsT0FBTyxtQ0FBSSxPQUFZLENBQUM7O0tBQ3hDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZSxzQkFBc0I7O1lBQ25DLElBQUksd0JBQXdCLEtBQUssSUFBSSxFQUFFO2dCQUNyQyxPQUFPLHdCQUF3QixDQUFDO2FBQ2pDO1lBRUQsa0ZBQWtGO1lBQ2xGLHdGQUF3RjtZQUN4RiwyRkFBMkY7WUFDM0YseUZBQXlGO1lBQ3pGLDhEQUE4RDtZQUM5RCxzRkFBc0Y7WUFDdEYsTUFBTSxlQUFlLEdBQ2pCLE1BQU0saUJBQWlCLENBQXlDLHVCQUF1QixDQUFDLENBQUM7WUFDN0YsTUFBTSxzQkFBc0IsR0FDeEIsTUFBTSxpQkFBaUIsQ0FDbkIscUNBQXFDLENBQUMsQ0FBQztZQUMvQyxPQUFPLHdCQUF3QixtQ0FBTyxlQUFlLEdBQUssc0JBQXNCLENBQUMsQ0FBQztRQUNwRixDQUFDO0tBQUE7SUFFRCxTQUFzQixXQUFXLENBQzdCLElBQWMsRUFBRSxNQUFpQzs7WUFDbkQsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO2dCQUNwQixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7YUFDZDtZQUVELHlEQUF5RDtZQUN6RCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMzQyxNQUFNLEVBQUUsR0FBRyxNQUFNLHNCQUFzQixFQUFFLENBQUM7WUFFMUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFBLDJCQUFhLEVBQUMsT0FBTyxDQUFDLENBQUM7WUFDdkQsSUFBSSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsTUFBTSxFQUFFO2dCQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUM1QyxPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsTUFBTSxFQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUMsR0FBRyxhQUFhLENBQUM7WUFDckUsTUFBTSxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBQyxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUVqRixJQUFJLFVBQVUsYUFBVixVQUFVLHVCQUFWLFVBQVUsQ0FBRSxNQUFNLEVBQUU7Z0JBQ3RCLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFFRCxNQUFNLGlDQUFpQyxHQUFHLElBQUksR0FBRyxDQUFTO2dCQUN4RCxhQUFhO2dCQUNiLE9BQU87Z0JBQ1AsMkJBQTJCO2dCQUMzQiwrQkFBK0I7Z0JBQy9CLGVBQWU7Z0JBQ2YsZUFBZTtnQkFDZixhQUFhO2dCQUNiLGNBQWM7Z0JBQ2QsWUFBWTtnQkFDWixjQUFjO2dCQUNkLG9CQUFvQjtnQkFDcEIsMkJBQTJCO2dCQUMzQixxQkFBcUI7Z0JBQ3JCLHNDQUFzQzthQUN2QyxDQUFDLENBQUM7WUFFSCxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztpQkFDdEIsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsaUNBQWlDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2lCQUM3RCxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtnQkFDNUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFFakIsT0FBTyxHQUFHLENBQUM7WUFDYixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFakMsTUFBTSxZQUFZLGlEQUNiLGFBQWEsR0FDYixNQUFNLENBQUMsd0JBQXdCLENBQUMsR0FDaEMsU0FBUyxDQUNiLENBQUM7WUFFRixvRkFBb0Y7WUFDcEYsMEVBQTBFO1lBQzFFLE1BQU0sRUFBQyxXQUFXLEVBQUUsNkJBQTZCLEVBQUMsR0FBRyxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUV0RixNQUFNLE1BQU0sR0FBRyxvQkFBRSxDQUFDLGtCQUFrQixDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN6RCxNQUFNLEVBQUMsV0FBVyxFQUFDLEdBQUcsT0FBTyxDQUFDO2dCQUM1Qix3QkFBd0IsRUFBRSw0QkFBNEI7Z0JBQ3RELDRCQUE0QixFQUFFLDZCQUE2QjtnQkFDM0QsWUFBWSxFQUFFLFdBQVc7Z0JBQ3pCLFlBQVk7Z0JBQ1osTUFBTTtnQkFDTixTQUFTO2dCQUNULEtBQUs7Z0JBQ0wsTUFBTTtnQkFDTixFQUFFO2FBQ0gsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO2dCQUN0QixPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2FBQ2xEO1lBQ0QsT0FBTyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsS0FBSyxvQkFBRSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVFLENBQUM7S0FBQTtJQTNFRCxrQ0EyRUM7SUFFRCxTQUFnQixrQkFBa0IsQ0FBQyxRQUFnQixFQUFFLFFBQWtCO1FBQ3JFLElBQUksQ0FBQyxRQUFRO1lBQUUsT0FBTyxRQUFRLENBQUM7UUFDL0IseURBQXlEO1FBQ3pELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDL0MsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7Z0JBQUUsT0FBTyxHQUFHLENBQUM7U0FDdkM7UUFDRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBVEQsZ0RBU0M7SUFFRCxTQUFnQixPQUFPLENBQUMsRUFDdEIsd0JBQXdCLEdBQUcsSUFBSSxFQUMvQiw0QkFBNEIsRUFDNUIsWUFBWSxFQUNaLE1BQU0sRUFDTixTQUFTLEVBQ1QsS0FBSyxFQUNMLE1BQU0sRUFDTixZQUFZLEVBQ1osaUJBQWlCLEVBQ2pCLFNBQVMsRUFDVCxFQUFFLEdBVUg7UUFDQyxJQUFJLFVBQXNCLENBQUM7UUFFM0IsSUFBSSxTQUFTLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRTtZQUMxQyxNQUFNLGlCQUFpQixHQUFHLFNBQVMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDL0QsU0FBUyxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1NBQzlDO2FBQU07WUFDTCxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztTQUMvQjtRQUVELElBQUksTUFBTSxFQUFFO1lBQ1YsVUFBVSxHQUFHLElBQUksOEJBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0MscUVBQXFFO1lBQ3JFLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1lBQ2pELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3pDLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekIsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFBLG1DQUFxQixFQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2FBQzdEO1lBQ0QsU0FBUyxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUN2QzthQUFNO1lBQ0wsVUFBVSxHQUFHLElBQUksZ0NBQWtCLEVBQUUsQ0FBQztTQUN2QztRQUVELGdGQUFnRjtRQUNoRixNQUFNLFdBQVcsR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQztRQUM3QyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRTtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7U0FDekM7UUFDRCxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7U0FDdEY7UUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXJGLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEQsTUFBTSxDQUFDLFNBQVM7WUFDWixDQUFDLFFBQWdCLEVBQUUsT0FBZSxFQUFFLGtCQUEyQixFQUM5RCxPQUFtQyxFQUFFLFdBQTZCLEVBQUUsRUFBRTtnQkFDckUsTUFBTSxRQUFRLEdBQ1Ysa0JBQWtCLENBQUMseUJBQXlCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDcEYsSUFBSSxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUNqQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNqQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztpQkFDaEY7WUFDSCxDQUFDLENBQUM7UUFFTixzRkFBc0Y7UUFDdEYseUVBQXlFO1FBQ3pFLHNFQUFzRTtRQUN0RSxNQUFNLCtCQUErQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUQsK0JBQStCLENBQUMsVUFBVSxHQUFHLENBQUMsUUFBZ0IsRUFBRSxFQUFFO1lBQ2hFLE1BQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDM0MsSUFBSSxLQUFLLEVBQUU7Z0JBQ1QsTUFBTSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBQ3BDLDhEQUE4RDtnQkFDOUQsSUFBSSxHQUFHLEtBQUssS0FBSyxJQUFJLEdBQUcsS0FBSyxPQUFPO29CQUFFLE9BQU8sS0FBSyxDQUFDO2dCQUNuRCxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNsQywyQkFBMkI7b0JBQzNCLFFBQVEsR0FBRyxJQUFJLENBQUM7aUJBQ2pCO3FCQUFNO29CQUNMLHNDQUFzQztvQkFDdEMsUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQztpQkFDL0I7YUFDRjtZQUNELE9BQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUM7UUFFRixTQUFTLDJCQUEyQixDQUNoQyxVQUFrQixFQUFFLGNBQXNCLEVBQzFDLGVBQW1DO1lBQ3JDLE9BQU8sb0JBQUUsQ0FBQyxpQkFBaUIsQ0FDdkIsVUFBVSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsK0JBQStCLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNkLFNBQVMsR0FBRyxJQUFJLDBCQUFZLENBQ3hCLEtBQUssRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztTQUN0RjtRQUVELElBQUksV0FBVyxFQUFFO1lBQ2YsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN2RSxTQUFTLENBQUMsMkJBQTJCLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7Z0JBQzNELDhGQUE4RjtnQkFDOUYsNEZBQTRGO2dCQUM1Riw2RkFBNkY7Z0JBQzdGLHNGQUFzRjtnQkFDdEYsT0FBTyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzNFLENBQUMsQ0FBQztTQUNIO1FBRUQsbUZBQW1GO1FBQ25GLHNGQUFzRjtRQUN0Rix1Q0FBdUM7UUFDdkMsU0FBUyxDQUFDLG1CQUFtQixHQUFHLEtBQUssQ0FBQztRQUV0Qyx1RkFBdUY7UUFDdkYsbUZBQW1GO1FBQ25GLGlGQUFpRjtRQUNqRixpRkFBaUY7UUFDakYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFO1lBQzVDLElBQUksU0FBUyxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQUU7Z0JBQ3pDLFlBQVksQ0FBQywwQkFBMEIsR0FBRyxJQUFJLENBQUM7Z0JBQy9DLHVGQUF1RjtnQkFDdkYsdUZBQXVGO2dCQUN2RiwwRkFBMEY7Z0JBQzFGLGlGQUFpRjtnQkFDakYsSUFBSSxXQUFXLEVBQUU7b0JBQ2YsU0FBUyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztpQkFDdEM7YUFDRjtpQkFBTTtnQkFDTCxZQUFZLENBQUMsMEJBQTBCLEdBQUcsS0FBSyxDQUFDO2FBQ2pEO1NBQ0Y7UUFFRCx1RkFBdUY7UUFDdkYsb0ZBQW9GO1FBQ3BGLDRFQUE0RTtRQUM1RSxJQUFJLFlBQVksQ0FBQywwQkFBMEIsRUFBRTtZQUMzQyxTQUFTLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDO1NBQzFDO1FBRUQsTUFBTSxzQkFBc0IsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDO1FBQ3BELFNBQVMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7WUFDMUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM3QixPQUFPLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDcEM7WUFDRCxPQUFPLHNCQUFzQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDMUQsQ0FBQyxDQUFDO1FBQ0YsTUFBTSw2QkFBNkIsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2pGLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtZQUNoRCxNQUFNLGlCQUFpQixHQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUMsQ0FBQztZQUUvRSwrRUFBK0U7WUFDL0Usd0JBQXdCO1lBQ3hCLG1FQUFtRTtZQUNuRSwwRkFBMEY7WUFDMUYsdUNBQXVDO1lBQ3ZDLElBQUksUUFBUSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7WUFFdkYsZ0VBQWdFO1lBQ2hFLHdGQUF3RjtZQUN4RixrRkFBa0Y7WUFDbEYsNkRBQTZEO1lBQzdELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFekUsSUFBSSxlQUFlO2dCQUNmLFFBQVE7b0JBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixDQUFDO2dCQUMzRixPQUFPLElBQUksQ0FBQztZQUVkLE9BQU8sNkJBQTZCLENBQUMsUUFBUSxDQUFDLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRixDQUFDLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUMsQ0FBQyxDQUFDO1FBQ2pGLG1DQUFtQyxDQUMvQixNQUFNLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO1FBRW5FLE1BQU0sQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLFFBQWdCLEVBQUUsb0JBQTRCLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUMxRixTQUFTLENBQUMsYUFBYSxFQUN2QixrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxRSxJQUFJLHdCQUF3QixFQUFFO1lBQzVCLHVEQUF1RDtZQUN2RCxpRUFBaUU7WUFDakUsZ0ZBQWdGO1lBQ2hGLG9GQUFvRjtZQUNwRixNQUFNLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxRQUFnQixFQUFFLG9CQUE0QixFQUFFLEVBQUU7Z0JBQzlFLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRSxPQUFPLElBQUEsbUNBQXFCLEVBQUMsUUFBUSxFQUFFLGlCQUFpQixDQUFDLEdBQUcsT0FBTyxDQUFDO1lBQ3RFLENBQUMsQ0FBQztTQUNIO1FBQ0Qsc0ZBQXNGO1FBQ3RGLHdCQUF3QjtRQUN2QixNQUFjLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxZQUFvQixFQUFFLEVBQUU7WUFDL0QsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsWUFBWSxFQUFFLENBQUMsQ0FBQztZQUN2RCxPQUFPLENBQUMsS0FBSyxDQUFDLGdGQUFnRixDQUFDLENBQUM7UUFDbEcsQ0FBQyxDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQW1CLENBQUMsRUFDcEMsT0FBTyxFQUNQLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsaUJBQWlCLEVBQ2pCLGdCQUFnQixFQUNoQixrQkFBa0IsR0FBRyxFQUFFLEdBQ3hCLEVBQUUsRUFBRSxDQUNELE9BQU8sQ0FBQyxlQUFlLENBQ25CLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQ3hFLGlCQUFpQixFQUFFLGdCQUFnQixFQUFFO1lBQ25DLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxNQUFNO1lBQ25DLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxLQUFLO1lBQ2pDLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDLGlCQUFpQjtTQUN4RCxDQUFDLENBQUM7UUFFWCxJQUFJLENBQUMsaUJBQWlCLEVBQUU7WUFDdEIsaUJBQWlCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUM1Qiw4QkFBOEIsQ0FBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMxRTtRQUNELE1BQU0sRUFBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBQyxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztZQUMvRCxTQUFTLEVBQUUsS0FBSztZQUNoQixPQUFPLEVBQUUsWUFBWTtZQUNyQixJQUFJLEVBQUUsTUFBTTtZQUNaLFlBQVk7WUFDWix3QkFBd0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1lBQ2xELGlCQUFpQjtTQUNsQixDQUFDLENBQUM7UUFDSCxNQUFNLGlCQUFpQixHQUFHLFVBQWdDLENBQUM7UUFDM0QsSUFBSSxPQUFPLEdBQUcsbUJBQW1CLENBQUM7UUFDbEMsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxvQkFBRSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzNGLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDYixJQUFJLFNBQVMsQ0FBQyxzQkFBc0IsRUFBRTtnQkFDcEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLE9BQVEsQ0FBQyxDQUFDO2FBQzFGO1lBQ0QsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFO2dCQUN0QixNQUFNLFFBQVEsR0FBRyxJQUFBLCtCQUFpQixFQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDakYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ2hEO1NBQ0Y7UUFFRCw0RUFBNEU7UUFDNUUscURBQXFEO1FBQ3JELElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTyxFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUMsQ0FBQztRQUU1QyxJQUFJLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRTtZQUNoQyx5RUFBeUU7WUFDekUsNEVBQTRFO1lBQzVFLGFBQWE7WUFDYixFQUFFLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQztTQUN6RDtRQUVELHdFQUF3RTtRQUN4RSxvREFBb0Q7UUFDcEQsS0FBSyxNQUFNLFFBQVEsSUFBSSxlQUFlLEVBQUU7WUFDdEMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztTQUN4QztRQUVELE9BQU8sRUFBQyxPQUFPLEVBQUUsV0FBVyxFQUFDLENBQUM7SUFDaEMsQ0FBQztJQXBRRCwwQkFvUUM7SUFFRCxTQUFTLG1CQUFtQixDQUFDLFNBQXVCLEVBQUUsRUFBaUI7UUFDckUsT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUNuQyxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELFNBQVMseUJBQXlCLENBQUMsUUFBZ0I7UUFDakQsT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsU0FBUyw4QkFBOEIsQ0FDbkMsT0FBd0IsRUFBRSxTQUF1QixFQUFFLFNBQWtCLEVBQ3JFLEVBQXFCO1FBQ3ZCLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUUzQyx3RkFBd0Y7UUFDeEYsSUFBSSxhQUFhLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDN0MsSUFBSSxTQUFTLFlBQVksRUFBRSxDQUFDLFlBQVksRUFBRTtZQUN4QyxhQUFhLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsQ0FBQztTQUMzRjtRQUNELE1BQU0sV0FBVyxHQUFvQixFQUFFLENBQUM7UUFDeEMsbUVBQW1FO1FBQ25FLDhEQUE4RDtRQUM5RCxvRUFBb0U7UUFDcEUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7UUFDdkQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7UUFDdEQsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9GLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzVDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQix5REFBeUQ7WUFDekQsK0JBQStCO1lBQy9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDM0Q7UUFFRCxJQUFJLFNBQVMsWUFBWSxFQUFFLENBQUMsWUFBWSxFQUFFO1lBQ3hDLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUN0RDtRQUVELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQ3ZCLGdFQUFnRTtZQUNoRSxzQkFBc0I7WUFDdEIsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDLENBQUM7WUFDNUQsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUM7U0FDM0Q7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNsRixPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsU0FBZ0IsbUNBQW1DLENBQy9DLE1BQXNCLEVBQUUsWUFBNkIsRUFBRSxTQUF1QixFQUM5RSw0QkFBcUM7UUFDdkMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUM1RCxNQUFNLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxnQkFBd0IsRUFBRSxrQkFBMkIsRUFBRSxFQUFFO1lBQ3RGLE1BQU0sUUFBUSxHQUFHLEdBQUcsZ0JBQWdCLElBQUksa0JBQWtCLEVBQUUsQ0FBQztZQUM3RCxvRUFBb0U7WUFDcEUsMkRBQTJEO1lBQzNELHdEQUF3RDtZQUN4RCxxRUFBcUU7WUFDckUsSUFBSSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzNDLE9BQU8seUJBQXlCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ2hEO1lBQ0QsTUFBTSxNQUFNLEdBQUcsc0JBQXNCLENBQUMsZ0JBQWdCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUM1RSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ2hELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUMsQ0FBQztRQUVGLFNBQVMsc0JBQXNCLENBQUMsZ0JBQXdCLEVBQUUsa0JBQTJCO1lBQ25GLE1BQU0sa0JBQWtCLEdBQ3BCLGtCQUFrQixDQUFDLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ2pGLE1BQU0sa0JBQWtCLEdBQUcsR0FBRyxTQUFTLENBQUMsYUFBYSxJQUFJLGtCQUFrQixFQUFFLENBQUM7WUFDOUUsSUFBSSw0QkFBNEIsS0FBSyxJQUFJLEVBQUU7Z0JBQ3pDLE9BQU8sa0JBQWtCLENBQUM7YUFDM0I7WUFFRCx3RkFBd0Y7WUFDeEYsc0ZBQXNGO1lBQ3RGLHlGQUF5RjtZQUN6RiwrQ0FBK0M7WUFDL0MsSUFBSTtnQkFDRixNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLGdCQUFnQixFQUFFLG9CQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsRixJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFO29CQUN2QyxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUM7aUJBQzlCO2FBQ0Y7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWiw2RUFBNkU7Z0JBQzdFLCtDQUErQzthQUNoRDtZQUVELHlGQUF5RjtZQUN6RixxREFBcUQ7WUFDckQsdURBQXVEO1lBQ3ZELG1GQUFtRjtZQUNuRixzRUFBc0U7WUFDdEUsMEZBQTBGO1lBQzFGLDZFQUE2RTtZQUM3RSxtREFBbUQ7WUFDbkQsd0RBQXdEO1lBQ3hELGdDQUFnQztZQUNoQywyQ0FBMkM7WUFDM0Msd0RBQXdEO1lBQ3hELDJFQUEyRTtZQUMzRSxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pELE1BQU0saUJBQWlCLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQztnQkFDL0UsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7b0JBQ3BDLE1BQU0sVUFBVSxHQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBRSxFQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUMsQ0FBQyxDQUVqRSxDQUFDLFFBQVEsQ0FBQztvQkFDL0IsSUFBSSxVQUFVLEVBQUU7d0JBQ2QsT0FBTyxVQUFVLENBQUM7cUJBQ25CO2lCQUNGO2FBQ0Y7WUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxvQkFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxvQkFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7Z0JBQ3hGLE1BQU0sQ0FBQyxhQUFhLEVBQUU7Z0JBQ3hCLE9BQU8sTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFDLFFBQVEsRUFBRSxnQkFBZ0IsRUFBa0IsQ0FBQyxDQUFDO2FBQzVFO1lBRUQsMkZBQTJGO1lBQzNGLHlGQUF5RjtZQUN6Riw4QkFBOEI7WUFDOUIsbUZBQW1GO1lBQ25GLHNGQUFzRjtZQUN0Rix3RkFBd0Y7WUFDeEYsMkZBQTJGO1lBQzNGLDhEQUE4RDtZQUM5RCw4RkFBOEY7WUFDOUYsMERBQTBEO1lBQzFELDJGQUEyRjtZQUMzRiw0RkFBNEY7WUFDNUYsc0VBQXNFO1lBQ3RFLG9GQUFvRjtZQUNwRixJQUFJLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDL0MsT0FBTyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZEO2lCQUFNLElBQ0gsa0JBQWtCLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO2dCQUM1RixPQUFPLGtCQUFrQixDQUFDO2FBQzNCO1lBQ0QsTUFBTSxpQkFBaUIsR0FDbkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNoRixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDdEYsT0FBTyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxLQUFLLGtCQUFrQixFQUFFLENBQUM7UUFDN0YsQ0FBQztJQUNILENBQUM7SUEvRkQsa0ZBK0ZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vIGB0c2Mtd3JhcHBlZGAgaGVscGVycyBhcmUgbm90IGV4cG9zZWQgaW4gdGhlIHByaW1hcnkgYEBiYXplbC9jb25jYXRqc2AgZW50cnktcG9pbnQuXG4vLyBUT0RPOiBVcGRhdGUgd2hlbiBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9ydWxlc19ub2RlanMvcHVsbC8zMjg2IGlzIGF2YWlsYWJsZS5cbmltcG9ydCB7QmF6ZWxPcHRpb25zIGFzIEV4dGVybmFsQmF6ZWxPcHRpb25zLCBDYWNoZWRGaWxlTG9hZGVyLCBDb21waWxlckhvc3QsIGNvbnN0cnVjdE1hbmlmZXN0LCBkZWJ1ZywgRmlsZUNhY2hlLCBGaWxlTG9hZGVyLCBwYXJzZVRzY29uZmlnLCByZXNvbHZlTm9ybWFsaXplZFBhdGgsIHJ1bkFzV29ya2VyLCBydW5Xb3JrZXJMb29wLCBVbmNhY2hlZEZpbGVMb2FkZXJ9IGZyb20gJ0BiYXplbC9jb25jYXRqcy9pbnRlcm5hbC90c2Nfd3JhcHBlZCc7XG5cbmltcG9ydCB0eXBlIHtBbmd1bGFyQ29tcGlsZXJPcHRpb25zLCBDb21waWxlckhvc3QgYXMgTmdDb21waWxlckhvc3QsIFRzRW1pdENhbGxiYWNrLCBQcm9ncmFtLCBDb21waWxlck9wdGlvbnN9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHNpY2tsZSBmcm9tICd0c2lja2xlJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7cGF0aFRvRmlsZVVSTH0gZnJvbSAndXJsJztcblxudHlwZSBDb21waWxlckNsaU1vZHVsZSA9XG4gICAgdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJykmdHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3ByaXZhdGUvYmF6ZWwnKTtcblxuLy8gQWRkIGRldm1vZGUgZm9yIGJsYXplIGludGVybmFsXG5pbnRlcmZhY2UgQmF6ZWxPcHRpb25zIGV4dGVuZHMgRXh0ZXJuYWxCYXplbE9wdGlvbnMge1xuICBkZXZtb2RlPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gdGhlIHByZXZpb3VzbHkgbG9hZGVkIGBjb21waWxlci1jbGlgIG1vZHVsZSBleHBvcnRzLiBXZSBjYWNoZSB0aGUgZXhwb3J0c1xuICogYXMgYG5nYy13cmFwcGVkYCBjYW4gcnVuIGFzIHBhcnQgb2YgYSB3b3JrZXIgd2hlcmUgdGhlIEFuZ3VsYXIgY29tcGlsZXIgc2hvdWxkIG5vdCBiZVxuICogcmVzb2x2ZWQgdGhyb3VnaCBhIGR5bmFtaWMgaW1wb3J0IGZvciBldmVyeSBidWlsZC5cbiAqL1xubGV0IF9jYWNoZWRDb21waWxlckNsaU1vZHVsZTogQ29tcGlsZXJDbGlNb2R1bGV8bnVsbCA9IG51bGw7XG5cbmNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5jb25zdCBOR0NfR0VOX0ZJTEVTID0gL14oLio/KVxcLihuZ2ZhY3Rvcnl8bmdzdW1tYXJ5fG5nc3R5bGV8c2hpbVxcLm5nc3R5bGUpKC4qKSQvO1xuLy8gRklYTUU6IHdlIHNob3VsZCBiZSBhYmxlIHRvIGFkZCB0aGUgYXNzZXRzIHRvIHRoZSB0c2NvbmZpZyBzbyBGaWxlTG9hZGVyXG4vLyBrbm93cyBhYm91dCB0aGVtXG5jb25zdCBOR0NfQVNTRVRTID0gL1xcLihjc3N8aHRtbHxuZ3N1bW1hcnlcXC5qc29uKSQvO1xuXG5jb25zdCBCQVpFTF9CSU4gPSAvXFxiKGJsYXplfGJhemVsKS1vdXRcXGIuKj9cXGJiaW5cXGIvO1xuXG4vLyBOb3RlOiBXZSBjb21waWxlIHRoZSBjb250ZW50IG9mIG5vZGVfbW9kdWxlcyB3aXRoIHBsYWluIG5nYyBjb21tYW5kIGxpbmUuXG5jb25zdCBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMID0gZmFsc2U7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4oYXJncykge1xuICBpZiAocnVuQXNXb3JrZXIoYXJncykpIHtcbiAgICBhd2FpdCBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXdhaXQgcnVuT25lQnVpbGQoYXJncykgPyAwIDogMTtcbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqIFRoZSBvbmUgRmlsZUNhY2hlIGluc3RhbmNlIHVzZWQgaW4gdGhpcyBwcm9jZXNzLiAqL1xuY29uc3QgZmlsZUNhY2hlID0gbmV3IEZpbGVDYWNoZTx0cy5Tb3VyY2VGaWxlPihkZWJ1Zyk7XG5cbi8qKlxuICogTG9hZHMgYSBtb2R1bGUgdGhhdCBjYW4gZWl0aGVyIGJlIENvbW1vbkpTIG9yIGFuIEVTTW9kdWxlLiBUaGlzIGlzIGRvbmVcbiAqIGFzIGludGVyb3Agd2l0aCB0aGUgY3VycmVudCBkZXZtb2RlIENvbW1vbkpTIGFuZCBwcm9kbW9kZSBFU00gb3V0cHV0LlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkTW9kdWxlSW50ZXJvcDxUPihtb2R1bGVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPFQ+IHtcbiAgLy8gTm90ZTogVGhpcyBhc3N1bWVzIHRoYXQgdGhlcmUgYXJlIG5vIGNvbmRpdGlvbmFsIGV4cG9ydHMgc3dpdGNoaW5nIGJldHdlZW4gYGltcG9ydGBcbiAgLy8gb3IgYHJlcXVpcmVgLiBXZSBjYW5ub3QgZnVsbHkgcmVseSBvbiB0aGUgZHluYW1pYyBpbXBvcnQgZXhwcmVzc2lvbiBoZXJlIGJlY2F1c2UgdGhlXG4gIC8vIEJhemVsIE5vZGVKUyBydWxlcyBkbyBub3QgcGF0Y2ggdGhlIGBpbXBvcnRgIE5vZGVKUyBtb2R1bGUgcmVzb2x1dGlvbiwgYW5kIHRoaXMgd291bGRcbiAgLy8gbWFrZSBuZ2Mtd3JhcHBlZCBkZXBlbmRlbnQgb24gdGhlIGxpbmtlci4gVGhlIGxpbmtlciBpcyBub3QgZW5hYmxlZCB3aGVuIHRoZSBgbmdjLXdyYXBwZWRgXG4gIC8vIGJpbmFyeSBpcyBzaGlwcGVkIGluIHRoZSBOUE0gcGFja2FnZSBhbmQgaXMgbm90IGF2YWlsYWJsZSBpbiBHb29nbGUzIGVpdGhlci5cbiAgY29uc3QgcmVzb2x2ZWRVcmwgPSBwYXRoVG9GaWxlVVJMKHJlcXVpcmUucmVzb2x2ZShtb2R1bGVOYW1lKSk7XG4gIGNvbnN0IGV4cG9ydHM6IFBhcnRpYWw8VD4me2RlZmF1bHQ/OiBUfSA9XG4gICAgICBhd2FpdCBuZXcgRnVuY3Rpb24oJ20nLCBgcmV0dXJuIGltcG9ydChtKTtgKShyZXNvbHZlZFVybCk7XG4gIHJldHVybiBleHBvcnRzLmRlZmF1bHQgPz8gZXhwb3J0cyBhcyBUO1xufVxuXG4vKipcbiAqIEZldGNoZXMgdGhlIEFuZ3VsYXIgY29tcGlsZXIgQ0xJIG1vZHVsZSBkeW5hbWljYWxseSwgYWxsb3dpbmcgZm9yIGFuIEVTTVxuICogdmFyaWFudCBvZiB0aGUgY29tcGlsZXIuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZldGNoQ29tcGlsZXJDbGlNb2R1bGUoKTogUHJvbWlzZTxDb21waWxlckNsaU1vZHVsZT4ge1xuICBpZiAoX2NhY2hlZENvbXBpbGVyQ2xpTW9kdWxlICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIF9jYWNoZWRDb21waWxlckNsaU1vZHVsZTtcbiAgfVxuXG4gIC8vIE5vdGU6IFdlIGxvYWQgdGhlIGNvbXBpbGVyLWNsaSBwYWNrYWdlIGR5bmFtaWNhbGx5IHVzaW5nIGBsb2FkTW9kdWxlSW50ZXJvcGAgYXNcbiAgLy8gdGhpcyBzY3JpcHQgcnVucyBhcyBDb21tb25KUyBtb2R1bGUgYnV0IHRoZSBjb21waWxlci1jbGkgY291bGQgYmUgYnVpbHQgYXMgc3RyaWN0IEVTTVxuICAvLyBwYWNrYWdlLiBVbmZvcnR1bmF0ZWx5IHdlIGhhdmUgYSBtaXggb2YgQ29tbW9uSlMgYW5kIEVTTSBvdXRwdXQgaGVyZSBiZWNhdXNlIHRoZSBkZXZtb2RlXG4gIC8vIG91dHB1dCBpcyBzdGlsbCB1c2luZyBDb21tb25KUyBhbmQgdGhpcyBpcyBwcmltYXJpbHkgdXNlZCBmb3IgdGVzdGluZy4gQWxzbyBpbnNpZGUgRzMsXG4gIC8vIHRoZSBkZXZtb2RlIG91dHB1dCB3aWxsIHJlbWFpbiBDb21tb25KUyByZWdhcmRsZXNzIGZvciBub3cuXG4gIC8vIFRPRE86IEZpeCB0aGlzIHVwIG9uY2UgZGV2bW9kZSBhbmQgcHJvZG1vZGUgYXJlIGNvbWJpbmVkIGFuZCB3ZSB1c2UgRVNNIGV2ZXJ5d2hlcmUuXG4gIGNvbnN0IGNvbXBpbGVyRXhwb3J0cyA9XG4gICAgICBhd2FpdCBsb2FkTW9kdWxlSW50ZXJvcDx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuICBjb25zdCBjb21waWxlclByaXZhdGVFeHBvcnRzID1cbiAgICAgIGF3YWl0IGxvYWRNb2R1bGVJbnRlcm9wPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9wcml2YXRlL2JhemVsJyk+KFxuICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCcpO1xuICByZXR1cm4gX2NhY2hlZENvbXBpbGVyQ2xpTW9kdWxlID0gey4uLmNvbXBpbGVyRXhwb3J0cywgLi4uY29tcGlsZXJQcml2YXRlRXhwb3J0c307XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChcbiAgICBhcmdzOiBzdHJpbmdbXSwgaW5wdXRzPzoge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChhcmdzWzBdID09PSAnLXAnKSB7XG4gICAgYXJncy5zaGlmdCgpO1xuICB9XG5cbiAgLy8gU3RyaXAgbGVhZGluZyBhdC1zaWducywgdXNlZCB0byBpbmRpY2F0ZSBhIHBhcmFtcyBmaWxlXG4gIGNvbnN0IHByb2plY3QgPSBhcmdzWzBdLnJlcGxhY2UoL15AKy8sICcnKTtcbiAgY29uc3QgbmcgPSBhd2FpdCBmZXRjaENvbXBpbGVyQ2xpTW9kdWxlKCk7XG5cbiAgY29uc3QgW3BhcnNlZE9wdGlvbnMsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHByb2plY3QpO1xuICBpZiAoZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHtiYXplbE9wdHMsIG9wdGlvbnM6IHRzT3B0aW9ucywgZmlsZXMsIGNvbmZpZ30gPSBwYXJzZWRPcHRpb25zO1xuICBjb25zdCB7ZXJyb3JzOiB1c2VyRXJyb3JzLCBvcHRpb25zOiB1c2VyT3B0aW9uc30gPSBuZy5yZWFkQ29uZmlndXJhdGlvbihwcm9qZWN0KTtcblxuICBpZiAodXNlckVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyh1c2VyRXJyb3JzKSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgYWxsb3dlZE5nQ29tcGlsZXJPcHRpb25zT3ZlcnJpZGVzID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAnZGlhZ25vc3RpY3MnLFxuICAgICd0cmFjZScsXG4gICAgJ2Rpc2FibGVFeHByZXNzaW9uTG93ZXJpbmcnLFxuICAgICdkaXNhYmxlVHlwZVNjcmlwdFZlcnNpb25DaGVjaycsXG4gICAgJ2kxOG5PdXRMb2NhbGUnLFxuICAgICdpMThuT3V0Rm9ybWF0JyxcbiAgICAnaTE4bk91dEZpbGUnLFxuICAgICdpMThuSW5Mb2NhbGUnLFxuICAgICdpMThuSW5GaWxlJyxcbiAgICAnaTE4bkluRm9ybWF0JyxcbiAgICAnaTE4blVzZUV4dGVybmFsSWRzJyxcbiAgICAnaTE4bkluTWlzc2luZ1RyYW5zbGF0aW9ucycsXG4gICAgJ3ByZXNlcnZlV2hpdGVzcGFjZXMnLFxuICAgICdjcmVhdGVFeHRlcm5hbFN5bWJvbEZhY3RvcnlSZWV4cG9ydHMnLFxuICBdKTtcblxuICBjb25zdCB1c2VyT3ZlcnJpZGVzID0gT2JqZWN0LmVudHJpZXModXNlck9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoW2tleV0pID0+IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcy5oYXMoa2V5KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVkdWNlKChvYmosIFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCB7fSk7XG5cbiAgY29uc3QgY29tcGlsZXJPcHRzOiBBbmd1bGFyQ29tcGlsZXJPcHRpb25zID0ge1xuICAgIC4uLnVzZXJPdmVycmlkZXMsXG4gICAgLi4uY29uZmlnWydhbmd1bGFyQ29tcGlsZXJPcHRpb25zJ10sXG4gICAgLi4udHNPcHRpb25zLFxuICB9O1xuXG4gIC8vIFRoZXNlIGFyZSBvcHRpb25zIHBhc3NlZCB0aHJvdWdoIGZyb20gdGhlIGBuZ19tb2R1bGVgIHJ1bGUgd2hpY2ggYXJlbid0IHN1cHBvcnRlZFxuICAvLyBieSB0aGUgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgYW5kIGFyZSBvbmx5IGludGVuZGVkIGZvciBgbmdjLXdyYXBwZWRgLlxuICBjb25zdCB7ZXhwZWN0ZWRPdXQsIF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lfSA9IGNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddO1xuXG4gIGNvbnN0IHRzSG9zdCA9IHRzLmNyZWF0ZUNvbXBpbGVySG9zdChjb21waWxlck9wdHMsIHRydWUpO1xuICBjb25zdCB7ZGlhZ25vc3RpY3N9ID0gY29tcGlsZSh7XG4gICAgYWxsRGVwc0NvbXBpbGVkV2l0aEJhemVsOiBBTExfREVQU19DT01QSUxFRF9XSVRIX0JBWkVMLFxuICAgIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU6IF91c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICAgIGV4cGVjdGVkT3V0czogZXhwZWN0ZWRPdXQsXG4gICAgY29tcGlsZXJPcHRzLFxuICAgIHRzSG9zdCxcbiAgICBiYXplbE9wdHMsXG4gICAgZmlsZXMsXG4gICAgaW5wdXRzLFxuICAgIG5nLFxuICB9KTtcbiAgaWYgKGRpYWdub3N0aWNzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3MoZGlhZ25vc3RpY3MpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3MuZXZlcnkoZCA9PiBkLmNhdGVnb3J5ICE9PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmVUb1Jvb3REaXJzKGZpbGVQYXRoOiBzdHJpbmcsIHJvb3REaXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmICghZmlsZVBhdGgpIHJldHVybiBmaWxlUGF0aDtcbiAgLy8gTkI6IHRoZSByb290RGlycyBzaG91bGQgaGF2ZSBiZWVuIHNvcnRlZCBsb25nZXN0LWZpcnN0XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcm9vdERpcnMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBkaXIgPSByb290RGlyc1tpXTtcbiAgICBjb25zdCByZWwgPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGRpciwgZmlsZVBhdGgpO1xuICAgIGlmIChyZWwuaW5kZXhPZignLicpICE9IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZSh7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbCA9IHRydWUsXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUsXG4gIGNvbXBpbGVyT3B0cyxcbiAgdHNIb3N0LFxuICBiYXplbE9wdHMsXG4gIGZpbGVzLFxuICBpbnB1dHMsXG4gIGV4cGVjdGVkT3V0cyxcbiAgZ2F0aGVyRGlhZ25vc3RpY3MsXG4gIGJhemVsSG9zdCxcbiAgbmcsXG59OiB7XG4gIGFsbERlcHNDb21waWxlZFdpdGhCYXplbD86IGJvb2xlYW4sXG4gIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWU/OiBib29sZWFuLCBjb21waWxlck9wdHM6IENvbXBpbGVyT3B0aW9ucywgdHNIb3N0OiB0cy5Db21waWxlckhvc3QsXG4gIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSxcbiAgICAgICAgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgICAgIGZpbGVzOiBzdHJpbmdbXSxcbiAgICAgICAgZXhwZWN0ZWRPdXRzOiBzdHJpbmdbXSxcbiAgZ2F0aGVyRGlhZ25vc3RpY3M/OiAocHJvZ3JhbTogUHJvZ3JhbSkgPT4gcmVhZG9ubHkgdHMuRGlhZ25vc3RpY1tdLFxuICBiYXplbEhvc3Q/OiBDb21waWxlckhvc3QsIG5nOiBDb21waWxlckNsaU1vZHVsZSxcbn0pOiB7ZGlhZ25vc3RpY3M6IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXSwgcHJvZ3JhbTogUHJvZ3JhbX0ge1xuICBsZXQgZmlsZUxvYWRlcjogRmlsZUxvYWRlcjtcblxuICBpZiAoYmF6ZWxPcHRzLm1heENhY2hlU2l6ZU1iICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBtYXhDYWNoZVNpemVCeXRlcyA9IGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAqICgxIDw8IDIwKTtcbiAgICBmaWxlQ2FjaGUuc2V0TWF4Q2FjaGVTaXplKG1heENhY2hlU2l6ZUJ5dGVzKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlQ2FjaGUucmVzZXRNYXhDYWNoZVNpemUoKTtcbiAgfVxuXG4gIGlmIChpbnB1dHMpIHtcbiAgICBmaWxlTG9hZGVyID0gbmV3IENhY2hlZEZpbGVMb2FkZXIoZmlsZUNhY2hlKTtcbiAgICAvLyBSZXNvbHZlIHRoZSBpbnB1dHMgdG8gYWJzb2x1dGUgcGF0aHMgdG8gbWF0Y2ggVHlwZVNjcmlwdCBpbnRlcm5hbHNcbiAgICBjb25zdCByZXNvbHZlZElucHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMoaW5wdXRzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0S2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qga2V5ID0gaW5wdXRLZXlzW2ldO1xuICAgICAgcmVzb2x2ZWRJbnB1dHMuc2V0KHJlc29sdmVOb3JtYWxpemVkUGF0aChrZXkpLCBpbnB1dHNba2V5XSk7XG4gICAgfVxuICAgIGZpbGVDYWNoZS51cGRhdGVDYWNoZShyZXNvbHZlZElucHV0cyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBVbmNhY2hlZEZpbGVMb2FkZXIoKTtcbiAgfVxuXG4gIC8vIERldGVjdCBmcm9tIGNvbXBpbGVyT3B0cyB3aGV0aGVyIHRoZSBlbnRyeXBvaW50IGlzIGJlaW5nIGludm9rZWQgaW4gSXZ5IG1vZGUuXG4gIGNvbnN0IGlzSW5JdnlNb2RlID0gISFjb21waWxlck9wdHMuZW5hYmxlSXZ5O1xuICBpZiAoIWNvbXBpbGVyT3B0cy5yb290RGlycykge1xuICAgIHRocm93IG5ldyBFcnJvcigncm9vdERpcnMgaXMgbm90IHNldCEnKTtcbiAgfVxuICBjb25zdCBiYXplbEJpbiA9IGNvbXBpbGVyT3B0cy5yb290RGlycy5maW5kKHJvb3REaXIgPT4gQkFaRUxfQklOLnRlc3Qocm9vdERpcikpO1xuICBpZiAoIWJhemVsQmluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGJhemVsIGJpbiBpbiB0aGUgcm9vdERpcnM6ICR7Y29tcGlsZXJPcHRzLnJvb3REaXJzfWApO1xuICB9XG5cbiAgY29uc3QgZXhwZWN0ZWRPdXRzU2V0ID0gbmV3IFNldChleHBlY3RlZE91dHMubWFwKHAgPT4gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChwKSkpO1xuXG4gIGNvbnN0IG9yaWdpbmFsV3JpdGVGaWxlID0gdHNIb3N0LndyaXRlRmlsZS5iaW5kKHRzSG9zdCk7XG4gIHRzSG9zdC53cml0ZUZpbGUgPVxuICAgICAgKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgd3JpdGVCeXRlT3JkZXJNYXJrOiBib29sZWFuLFxuICAgICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLCBzb3VyY2VGaWxlcz86IHRzLlNvdXJjZUZpbGVbXSkgPT4ge1xuICAgICAgICBjb25zdCByZWxhdGl2ZSA9XG4gICAgICAgICAgICByZWxhdGl2ZVRvUm9vdERpcnMoY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlTmFtZSksIFtjb21waWxlck9wdHMucm9vdERpcl0pO1xuICAgICAgICBpZiAoZXhwZWN0ZWRPdXRzU2V0LmhhcyhyZWxhdGl2ZSkpIHtcbiAgICAgICAgICBleHBlY3RlZE91dHNTZXQuZGVsZXRlKHJlbGF0aXZlKTtcbiAgICAgICAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgY29udGVudCwgd3JpdGVCeXRlT3JkZXJNYXJrLCBvbkVycm9yLCBzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgLy8gUGF0Y2ggZmlsZUV4aXN0cyB3aGVuIHJlc29sdmluZyBtb2R1bGVzLCBzbyB0aGF0IENvbXBpbGVySG9zdCBjYW4gYXNrIFR5cGVTY3JpcHQgdG9cbiAgLy8gcmVzb2x2ZSBub24tZXhpc3RpbmcgZ2VuZXJhdGVkIGZpbGVzIHRoYXQgZG9uJ3QgZXhpc3Qgb24gZGlzaywgYnV0IGFyZVxuICAvLyBzeW50aGV0aWMgYW5kIGFkZGVkIHRvIHRoZSBgcHJvZ3JhbVdpdGhTdHVic2AgYmFzZWQgb24gcmVhbCBpbnB1dHMuXG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QgPSBPYmplY3QuY3JlYXRlKHRzSG9zdCk7XG4gIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlckhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXIoXG4gICAgICBtb2R1bGVOYW1lOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcsXG4gICAgICBjb21waWxlck9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyk6IHRzLlJlc29sdmVkTW9kdWxlV2l0aEZhaWxlZExvb2t1cExvY2F0aW9ucyB7XG4gICAgcmV0dXJuIHRzLnJlc29sdmVNb2R1bGVOYW1lKFxuICAgICAgICBtb2R1bGVOYW1lLCBjb250YWluaW5nRmlsZSwgY29tcGlsZXJPcHRpb25zLCBnZW5lcmF0ZWRGaWxlTW9kdWxlUmVzb2x2ZXJIb3N0KTtcbiAgfVxuXG4gIGlmICghYmF6ZWxIb3N0KSB7XG4gICAgYmF6ZWxIb3N0ID0gbmV3IENvbXBpbGVySG9zdChcbiAgICAgICAgZmlsZXMsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB0c0hvc3QsIGZpbGVMb2FkZXIsIGdlbmVyYXRlZEZpbGVNb2R1bGVSZXNvbHZlcik7XG4gIH1cblxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICAgIGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgLy8gVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2Ygc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nIGNoZWNrcyB3aGV0aGVyIGBmaWxlTmFtZWAgaXMgcGFydCBvZlxuICAgICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAgIC8vIHNoaW1zIGZvciBvcmlnaW5hbCAudHMgZmlsZXMgaW4gdGhlIHByb2dyYW0gc2hvdWxkIGJlIHRyZWF0ZWQgaWRlbnRpY2FsbHkuIFRodXMsIHN0cmlwIHRoZVxuICAgICAgLy8gJy5uZ2ZhY3RvcnknIG9yICcubmdzdW1tYXJ5JyBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBhd2F5IGJlZm9yZSBjYWxsaW5nIHRoZSBkZWxlZ2F0ZS5cbiAgICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICAgIH07XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0LCBkaXNhYmxlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybWluZyBpbiB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0LlxuICAvLyBUaGUgQW5ndWxhciBjb21waWxlcnMgaGF2ZSB0aGVpciBvd24gbG9naWMgZm9yIGRlY29yYXRvciBwcm9jZXNzaW5nIGFuZCB3ZSB3b3VsZG4ndFxuICAvLyB3YW50IHRzaWNrbGUgdG8gaW50ZXJmZXJlIHdpdGggdGhhdC5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlICYmICFiYXplbE9wdHMuZGV2bW9kZSkge1xuICAgIGlmIChiYXplbE9wdHMud29ya3NwYWNlTmFtZSA9PT0gJ2dvb2dsZTMnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgICAgLy8gRW5hYmxlIHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0gaW4gZ29vZ2xlMyB3aXRoIEl2eSBtb2RlIGVuYWJsZWQuIFRoZSB0c2lja2xlXG4gICAgICAvLyBkZWNvcmF0b3IgdHJhbnNmb3JtYXRpb24gaXMgc3RpbGwgbmVlZGVkLiBUaGlzIG1pZ2h0IGJlIGJlY2F1c2Ugb2YgY3VzdG9tIGRlY29yYXRvcnNcbiAgICAgIC8vIHdpdGggdGhlIGBAQW5ub3RhdGlvbmAgSlNEb2MgdGhhdCB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtLlxuICAgICAgLy8gVE9ETzogRmlndXJlIG91dCB3aHkgdGhpcyBpcyBuZWVkZWQgaW4gZzMgYW5kIGhvdyB3ZSBjYW4gaW1wcm92ZSB0aGlzLiBGVy0yMjI1XG4gICAgICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAgICAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBBbmd1bGFyIGNvbXBpbGVyIG9wdGlvbiBpcyBub3QgcmVzcGVjdGVkIGJ5IGRlZmF1bHRcbiAgLy8gYXMgbmdjLXdyYXBwZWQgaGFuZGxlcyB0c2lja2xlIGVtaXQgb24gaXRzIG93bi4gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gdXBkYXRlXG4gIC8vIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QgYmFzZWQgb24gdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgZmxhZy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gIH1cblxuICBjb25zdCBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0ID0gYmF6ZWxIb3N0LmZpbGVFeGlzdHM7XG4gIGJhemVsSG9zdC5maWxlRXhpc3RzID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoTkdDX0FTU0VUUy50ZXN0KGZpbGVOYW1lKSkge1xuICAgICAgcmV0dXJuIHRzSG9zdC5maWxlRXhpc3RzKGZpbGVOYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RGaWxlRXhpc3QuY2FsbChiYXplbEhvc3QsIGZpbGVOYW1lKTtcbiAgfTtcbiAgY29uc3Qgb3JpZ0JhemVsSG9zdFNob3VsZE5hbWVNb2R1bGUgPSBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZS5iaW5kKGJhemVsSG9zdCk7XG4gIGJhemVsSG9zdC5zaG91bGROYW1lTW9kdWxlID0gKGZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBmbGF0TW9kdWxlT3V0UGF0aCA9XG4gICAgICAgIHBhdGgucG9zaXguam9pbihiYXplbE9wdHMucGFja2FnZSwgY29tcGlsZXJPcHRzLmZsYXRNb2R1bGVPdXRGaWxlICsgJy50cycpO1xuXG4gICAgLy8gVGhlIGJ1bmRsZSBpbmRleCBmaWxlIGlzIHN5bnRoZXNpemVkIGluIGJ1bmRsZV9pbmRleF9ob3N0IHNvIGl0J3Mgbm90IGluIHRoZVxuICAgIC8vIGNvbXBpbGF0aW9uVGFyZ2V0U3JjLlxuICAgIC8vIEhvd2V2ZXIgd2Ugc3RpbGwgd2FudCB0byBnaXZlIGl0IGFuIEFNRCBtb2R1bGUgbmFtZSBmb3IgZGV2bW9kZS5cbiAgICAvLyBXZSBjYW4ndCBlYXNpbHkgdGVsbCB3aGljaCBmaWxlIGlzIHRoZSBzeW50aGV0aWMgb25lLCBzbyB3ZSBidWlsZCB1cCB0aGUgcGF0aCB3ZSBleHBlY3RcbiAgICAvLyBpdCB0byBoYXZlIGFuZCBjb21wYXJlIGFnYWluc3QgdGhhdC5cbiAgICBpZiAoZmlsZU5hbWUgPT09IHBhdGgucG9zaXguam9pbihjb21waWxlck9wdHMuYmFzZVVybCwgZmxhdE1vZHVsZU91dFBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEFsc28gaGFuZGxlIHRoZSBjYXNlIHRoZSB0YXJnZXQgaXMgaW4gYW4gZXh0ZXJuYWwgcmVwb3NpdG9yeS5cbiAgICAvLyBQdWxsIHRoZSB3b3Jrc3BhY2UgbmFtZSBmcm9tIHRoZSB0YXJnZXQgd2hpY2ggaXMgZm9ybWF0dGVkIGFzIGBAd2tzcC8vcGFja2FnZTp0YXJnZXRgXG4gICAgLy8gaWYgaXQgdGhlIHRhcmdldCBpcyBmcm9tIGFuIGV4dGVybmFsIHdvcmtzcGFjZS4gSWYgdGhlIHRhcmdldCBpcyBmcm9tIHRoZSBsb2NhbFxuICAgIC8vIHdvcmtzcGFjZSB0aGVuIGl0IHdpbGwgYmUgZm9ybWF0dGVkIGFzIGAvL3BhY2thZ2U6dGFyZ2V0YC5cbiAgICBjb25zdCB0YXJnZXRXb3Jrc3BhY2UgPSBiYXplbE9wdHMudGFyZ2V0LnNwbGl0KCcvJylbMF0ucmVwbGFjZSgvXkAvLCAnJyk7XG5cbiAgICBpZiAodGFyZ2V0V29ya3NwYWNlICYmXG4gICAgICAgIGZpbGVOYW1lID09PVxuICAgICAgICAgICAgcGF0aC5wb3NpeC5qb2luKGNvbXBpbGVyT3B0cy5iYXNlVXJsLCAnZXh0ZXJuYWwnLCB0YXJnZXRXb3Jrc3BhY2UsIGZsYXRNb2R1bGVPdXRQYXRoKSlcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgcmV0dXJuIG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlKGZpbGVOYW1lKSB8fCBOR0NfR0VOX0ZJTEVTLnRlc3QoZmlsZU5hbWUpO1xuICB9O1xuXG4gIGNvbnN0IG5nSG9zdCA9IG5nLmNyZWF0ZUNvbXBpbGVySG9zdCh7b3B0aW9uczogY29tcGlsZXJPcHRzLCB0c0hvc3Q6IGJhemVsSG9zdH0pO1xuICBwYXRjaE5nSG9zdFdpdGhGaWxlTmFtZVRvTW9kdWxlTmFtZShcbiAgICAgIG5nSG9zdCwgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUpO1xuXG4gIG5nSG9zdC50b1N1bW1hcnlGaWxlTmFtZSA9IChmaWxlTmFtZTogc3RyaW5nLCByZWZlcnJpbmdTcmNGaWxlTmFtZTogc3RyaW5nKSA9PiBwYXRoLnBvc2l4LmpvaW4oXG4gICAgICBiYXplbE9wdHMud29ya3NwYWNlTmFtZSxcbiAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlTmFtZSwgY29tcGlsZXJPcHRzLnJvb3REaXJzKS5yZXBsYWNlKEVYVCwgJycpKTtcbiAgaWYgKGFsbERlcHNDb21waWxlZFdpdGhCYXplbCkge1xuICAgIC8vIE5vdGU6IFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdvdWxkIHdvcmsgYXMgd2VsbCxcbiAgICAvLyBidXQgd2UgY2FuIGJlIGZhc3RlciBhcyB3ZSBrbm93IGhvdyBgdG9TdW1tYXJ5RmlsZU5hbWVgIHdvcmtzLlxuICAgIC8vIE5vdGU6IFdlIGNhbid0IGRvIHRoaXMgaWYgc29tZSBkZXBzIGhhdmUgYmVlbiBjb21waWxlZCB3aXRoIHRoZSBjb21tYW5kIGxpbmUsXG4gICAgLy8gYXMgdGhhdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgZnJvbVN1bW1hcnlGaWxlTmFtZSAvIHRvU3VtbWFyeUZpbGVOYW1lXG4gICAgbmdIb3N0LmZyb21TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nTGliRmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBmaWxlTmFtZS5zcGxpdCgnLycpLnNwbGljZSgxKS5qb2luKCcvJyk7XG4gICAgICByZXR1cm4gcmVzb2x2ZU5vcm1hbGl6ZWRQYXRoKGJhemVsQmluLCB3b3Jrc3BhY2VSZWxhdGl2ZSkgKyAnLmQudHMnO1xuICAgIH07XG4gIH1cbiAgLy8gUGF0Y2ggYSBwcm9wZXJ0eSBvbiB0aGUgbmdIb3N0IHRoYXQgYWxsb3dzIHRoZSByZXNvdXJjZU5hbWVUb01vZHVsZU5hbWUgZnVuY3Rpb24gdG9cbiAgLy8gcmVwb3J0IGJldHRlciBlcnJvcnMuXG4gIChuZ0hvc3QgYXMgYW55KS5yZXBvcnRNaXNzaW5nUmVzb3VyY2UgPSAocmVzb3VyY2VOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGBcXG5Bc3NldCBub3QgZm91bmQ6XFxuICAke3Jlc291cmNlTmFtZX1gKTtcbiAgICBjb25zb2xlLmVycm9yKCdDaGVjayB0aGF0IGl0XFwncyBpbmNsdWRlZCBpbiB0aGUgYGFzc2V0c2AgYXR0cmlidXRlIG9mIHRoZSBgbmdfbW9kdWxlYCBydWxlLlxcbicpO1xuICB9O1xuXG4gIGNvbnN0IGVtaXRDYWxsYmFjazogVHNFbWl0Q2FsbGJhY2sgPSAoe1xuICAgIHByb2dyYW0sXG4gICAgdGFyZ2V0U291cmNlRmlsZSxcbiAgICB3cml0ZUZpbGUsXG4gICAgY2FuY2VsbGF0aW9uVG9rZW4sXG4gICAgZW1pdE9ubHlEdHNGaWxlcyxcbiAgICBjdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgfSkgPT5cbiAgICAgIHRzaWNrbGUuZW1pdFdpdGhUc2lja2xlKFxuICAgICAgICAgIHByb2dyYW0sIGJhemVsSG9zdCwgYmF6ZWxIb3N0LCBjb21waWxlck9wdHMsIHRhcmdldFNvdXJjZUZpbGUsIHdyaXRlRmlsZSxcbiAgICAgICAgICBjYW5jZWxsYXRpb25Ub2tlbiwgZW1pdE9ubHlEdHNGaWxlcywge1xuICAgICAgICAgICAgYmVmb3JlVHM6IGN1c3RvbVRyYW5zZm9ybWVycy5iZWZvcmUsXG4gICAgICAgICAgICBhZnRlclRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYWZ0ZXIsXG4gICAgICAgICAgICBhZnRlckRlY2xhcmF0aW9uczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyRGVjbGFyYXRpb25zLFxuICAgICAgICAgIH0pO1xuXG4gIGlmICghZ2F0aGVyRGlhZ25vc3RpY3MpIHtcbiAgICBnYXRoZXJEaWFnbm9zdGljcyA9IChwcm9ncmFtKSA9PlxuICAgICAgICBnYXRoZXJEaWFnbm9zdGljc0ZvcklucHV0c09ubHkoY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHByb2dyYW0sIG5nKTtcbiAgfVxuICBjb25zdCB7ZGlhZ25vc3RpY3MsIGVtaXRSZXN1bHQsIHByb2dyYW19ID0gbmcucGVyZm9ybUNvbXBpbGF0aW9uKHtcbiAgICByb290TmFtZXM6IGZpbGVzLFxuICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0cyxcbiAgICBob3N0OiBuZ0hvc3QsXG4gICAgZW1pdENhbGxiYWNrLFxuICAgIG1lcmdlRW1pdFJlc3VsdHNDYWxsYmFjazogdHNpY2tsZS5tZXJnZUVtaXRSZXN1bHRzLFxuICAgIGdhdGhlckRpYWdub3N0aWNzXG4gIH0pO1xuICBjb25zdCB0c2lja2xlRW1pdFJlc3VsdCA9IGVtaXRSZXN1bHQgYXMgdHNpY2tsZS5FbWl0UmVzdWx0O1xuICBsZXQgZXh0ZXJucyA9ICcvKiogQGV4dGVybnMgKi9cXG4nO1xuICBjb25zdCBoYXNFcnJvciA9IGRpYWdub3N0aWNzLnNvbWUoKGRpYWcpID0+IGRpYWcuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcik7XG4gIGlmICghaGFzRXJyb3IpIHtcbiAgICBpZiAoYmF6ZWxPcHRzLnRzaWNrbGVHZW5lcmF0ZUV4dGVybnMpIHtcbiAgICAgIGV4dGVybnMgKz0gdHNpY2tsZS5nZXRHZW5lcmF0ZWRFeHRlcm5zKHRzaWNrbGVFbWl0UmVzdWx0LmV4dGVybnMsIGNvbXBpbGVyT3B0cy5yb290RGlyISk7XG4gICAgfVxuICAgIGlmIChiYXplbE9wdHMubWFuaWZlc3QpIHtcbiAgICAgIGNvbnN0IG1hbmlmZXN0ID0gY29uc3RydWN0TWFuaWZlc3QodHNpY2tsZUVtaXRSZXN1bHQubW9kdWxlc01hbmlmZXN0LCBiYXplbEhvc3QpO1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMubWFuaWZlc3QsIG1hbmlmZXN0KTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiBjb21waWxhdGlvbiBmYWlscyB1bmV4cGVjdGVkbHksIHBlcmZvcm1Db21waWxhdGlvbiByZXR1cm5zIG5vIHByb2dyYW0uXG4gIC8vIE1ha2Ugc3VyZSBub3QgdG8gY3Jhc2ggYnV0IHJlcG9ydCB0aGUgZGlhZ25vc3RpY3MuXG4gIGlmICghcHJvZ3JhbSkgcmV0dXJuIHtwcm9ncmFtLCBkaWFnbm9zdGljc307XG5cbiAgaWYgKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgpIHtcbiAgICAvLyBOb3RlOiB3aGVuIHRzaWNrbGVFeHRlcm5zUGF0aCBpcyBwcm92aWRlZCwgd2UgYWx3YXlzIHdyaXRlIGEgZmlsZSBhcyBhXG4gICAgLy8gbWFya2VyIHRoYXQgY29tcGlsYXRpb24gc3VjY2VlZGVkLCBldmVuIGlmIGl0J3MgZW1wdHkgKGp1c3QgY29udGFpbmluZyBhblxuICAgIC8vIEBleHRlcm5zKS5cbiAgICBmcy53cml0ZUZpbGVTeW5jKGJhemVsT3B0cy50c2lja2xlRXh0ZXJuc1BhdGgsIGV4dGVybnMpO1xuICB9XG5cbiAgLy8gVGhlcmUgbWlnaHQgYmUgc29tZSBleHBlY3RlZCBvdXRwdXQgZmlsZXMgdGhhdCBhcmUgbm90IHdyaXR0ZW4gYnkgdGhlXG4gIC8vIGNvbXBpbGVyLiBJbiB0aGlzIGNhc2UsIGp1c3Qgd3JpdGUgYW4gZW1wdHkgZmlsZS5cbiAgZm9yIChjb25zdCBmaWxlTmFtZSBvZiBleHBlY3RlZE91dHNTZXQpIHtcbiAgICBvcmlnaW5hbFdyaXRlRmlsZShmaWxlTmFtZSwgJycsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xufVxuXG5mdW5jdGlvbiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBzZjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gIU5HQ19HRU5fRklMRVMudGVzdChzZi5maWxlTmFtZSkgJiZcbiAgICAgIChiYXplbE9wdHMuY29tcGlsYXRpb25UYXJnZXRTcmMuaW5kZXhPZihzZi5maWxlTmFtZSkgIT09IC0xKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFRvRm9yd2FyZFNsYXNoUGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZpbGVQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbn1cblxuZnVuY3Rpb24gZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KFxuICAgIG9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsIG5nUHJvZ3JhbTogUHJvZ3JhbSxcbiAgICBuZzogQ29tcGlsZXJDbGlNb2R1bGUpOiB0cy5EaWFnbm9zdGljW10ge1xuICBjb25zdCB0c1Byb2dyYW0gPSBuZ1Byb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG5cbiAgLy8gRm9yIHRoZSBJdnkgY29tcGlsZXIsIHRyYWNrIHRoZSBhbW91bnQgb2YgdGltZSBzcGVudCBmZXRjaGluZyBUeXBlU2NyaXB0IGRpYWdub3N0aWNzLlxuICBsZXQgcHJldmlvdXNQaGFzZSA9IG5nLlBlcmZQaGFzZS5VbmFjY291bnRlZDtcbiAgaWYgKG5nUHJvZ3JhbSBpbnN0YW5jZW9mIG5nLk5ndHNjUHJvZ3JhbSkge1xuICAgIHByZXZpb3VzUGhhc2UgPSBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKG5nLlBlcmZQaGFzZS5UeXBlU2NyaXB0RGlhZ25vc3RpY3MpO1xuICB9XG4gIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcbiAgLy8gVGhlc2UgY2hlY2tzIG1pcnJvciB0cy5nZXRQcmVFbWl0RGlhZ25vc3RpY3MsIHdpdGggdGhlIGltcG9ydGFudFxuICAvLyBleGNlcHRpb24gb2YgYXZvaWRpbmcgYi8zMDcwODI0MCwgd2hpY2ggaXMgdGhhdCBpZiB5b3UgY2FsbFxuICAvLyBwcm9ncmFtLmdldERlY2xhcmF0aW9uRGlhZ25vc3RpY3MoKSBpdCBzb21laG93IGNvcnJ1cHRzIHRoZSBlbWl0LlxuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSk7XG4gIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCkpO1xuICBjb25zdCBwcm9ncmFtRmlsZXMgPSB0c1Byb2dyYW0uZ2V0U291cmNlRmlsZXMoKS5maWx0ZXIoZiA9PiBpc0NvbXBpbGF0aW9uVGFyZ2V0KGJhemVsT3B0cywgZikpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHByb2dyYW1GaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHNmID0gcHJvZ3JhbUZpbGVzW2ldO1xuICAgIC8vIE5vdGU6IFdlIG9ubHkgZ2V0IHRoZSBkaWFnbm9zdGljcyBmb3IgaW5kaXZpZHVhbCBmaWxlc1xuICAgIC8vIHRvIGUuZy4gbm90IGNoZWNrIGxpYnJhcmllcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzZikpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4udHNQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgfVxuXG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBuZ1Byb2dyYW0uY29tcGlsZXIucGVyZlJlY29yZGVyLnBoYXNlKHByZXZpb3VzUGhhc2UpO1xuICB9XG5cbiAgaWYgKCFkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICAvLyBvbmx5IGdhdGhlciB0aGUgYW5ndWxhciBkaWFnbm9zdGljcyBpZiB3ZSBoYXZlIG5vIGRpYWdub3N0aWNzXG4gICAgLy8gaW4gYW55IG90aGVyIGZpbGVzLlxuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU3RydWN0dXJhbERpYWdub3N0aWNzKCkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4ubmdQcm9ncmFtLmdldE5nU2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuICByZXR1cm4gZGlhZ25vc3RpY3M7XG59XG5cbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBtYWluKHByb2Nlc3MuYXJndi5zbGljZSgyKSkudGhlbihleGl0Q29kZSA9PiBwcm9jZXNzLmV4aXRDb2RlID0gZXhpdENvZGUpLmNhdGNoKGUgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgcHJvY2Vzcy5leGl0Q29kZSA9IDE7XG4gIH0pO1xufVxuXG4vKipcbiAqIEFkZHMgc3VwcG9ydCBmb3IgdGhlIG9wdGlvbmFsIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgb3BlcmF0aW9uIHRvIGEgZ2l2ZW4gYG5nLkNvbXBpbGVySG9zdGAuXG4gKlxuICogVGhpcyBpcyB1c2VkIHdpdGhpbiBgbmdjLXdyYXBwZWRgIGFuZCB0aGUgQmF6ZWwgY29tcGlsYXRpb24gZmxvdywgYnV0IGlzIGV4cG9ydGVkIGhlcmUgdG8gYWxsb3dcbiAqIGZvciBvdGhlciBjb25zdW1lcnMgb2YgdGhlIGNvbXBpbGVyIHRvIGFjY2VzcyB0aGlzIHNhbWUgbG9naWMuIEZvciBleGFtcGxlLCB0aGUgeGkxOG4gb3BlcmF0aW9uXG4gKiBpbiBnMyBjb25maWd1cmVzIGl0cyBvd24gYG5nLkNvbXBpbGVySG9zdGAgd2hpY2ggYWxzbyByZXF1aXJlcyBgZmlsZU5hbWVUb01vZHVsZU5hbWVgIHRvIHdvcmtcbiAqIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICAgIG5nSG9zdDogTmdDb21waWxlckhvc3QsIGNvbXBpbGVyT3B0czogQ29tcGlsZXJPcHRpb25zLCBiYXplbE9wdHM6IEJhemVsT3B0aW9ucyxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBib29sZWFuKTogdm9pZCB7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjYWNoZUtleSA9IGAke2ltcG9ydGVkRmlsZVBhdGh9OiR7Y29udGFpbmluZ0ZpbGVQYXRofWA7XG4gICAgLy8gTWVtb2l6ZSB0aGlzIGxvb2t1cCB0byBhdm9pZCBleHBlbnNpdmUgcmUtcGFyc2VzIG9mIHRoZSBzYW1lIGZpbGVcbiAgICAvLyBXaGVuIHJ1biBhcyBhIHdvcmtlciwgdGhlIGFjdHVhbCB0cy5Tb3VyY2VGaWxlIGlzIGNhY2hlZFxuICAgIC8vIGJ1dCB3aGVuIHdlIGRvbid0IHJ1biBhcyBhIHdvcmtlciwgdGhlcmUgaXMgbm8gY2FjaGUuXG4gICAgLy8gRm9yIG9uZSBleGFtcGxlIHRhcmdldCBpbiBnMywgd2Ugc2F3IGEgY2FjaGUgaGl0IHJhdGUgb2YgNzU5MC83Njk1XG4gICAgaWYgKGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoLCBjb250YWluaW5nRmlsZVBhdGgpO1xuICAgIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuc2V0KGNhY2hlS2V5LCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gZG9GaWxlTmFtZVRvTW9kdWxlTmFtZShpbXBvcnRlZEZpbGVQYXRoOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVsYXRpdmVUYXJnZXRQYXRoID1cbiAgICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGltcG9ydGVkRmlsZVBhdGgsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKTtcbiAgICBjb25zdCBtYW5pZmVzdFRhcmdldFBhdGggPSBgJHtiYXplbE9wdHMud29ya3NwYWNlTmFtZX0vJHtyZWxhdGl2ZVRhcmdldFBhdGh9YDtcbiAgICBpZiAodXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG5cbiAgICAvLyBVbmxlc3MgbWFuaWZlc3QgcGF0aHMgYXJlIGV4cGxpY2l0bHkgZW5mb3JjZWQsIHdlIGluaXRpYWxseSBjaGVjayBpZiBhIG1vZHVsZSBuYW1lIGlzXG4gICAgLy8gc2V0IGZvciB0aGUgZ2l2ZW4gc291cmNlIGZpbGUuIFRoZSBjb21waWxlciBob3N0IGZyb20gYEBiYXplbC9jb25jYXRqc2Agc2V0cyBzb3VyY2VcbiAgICAvLyBmaWxlIG1vZHVsZSBuYW1lcyBpZiB0aGUgY29tcGlsYXRpb24gdGFyZ2V0cyBlaXRoZXIgVU1EIG9yIEFNRC4gVG8gZW5zdXJlIHRoYXQgdGhlIEFNRFxuICAgIC8vIG1vZHVsZSBuYW1lcyBtYXRjaCwgd2UgZmlyc3QgY29uc2lkZXIgdGhvc2UuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IChKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpIGFzIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1wb3J0QXM6IHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuaW1wb3J0QXM7XG4gICAgICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG1vZHVsZU5hbWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgICBuZ0hvc3QuYW1kTW9kdWxlTmFtZSkge1xuICAgICAgcmV0dXJuIG5nSG9zdC5hbWRNb2R1bGVOYW1lKHtmaWxlTmFtZTogaW1wb3J0ZWRGaWxlUGF0aH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gQU1EIG1vZHVsZSBuYW1lIGhhcyBiZWVuIHNldCBmb3IgdGhlIHNvdXJjZSBmaWxlIGJ5IHRoZSBgQGJhemVsL2NvbmNhdGpzYCBjb21waWxlclxuICAgIC8vIGhvc3QsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgaXMgbm90IHBhcnQgb2YgYSBmbGF0IG1vZHVsZSBub2RlIG1vZHVsZSBwYWNrYWdlLCB3ZSB1c2UgdGhlXG4gICAgLy8gZm9sbG93aW5nIHJ1bGVzIChpbiBvcmRlcik6XG4gICAgLy8gICAgMS4gSWYgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBgbm9kZV9tb2R1bGVzL2AsIHdlIHVzZSB0aGUgcGFja2FnZSBtb2R1bGUgbmFtZS5cbiAgICAvLyAgICAyLiBJZiBubyBjb250YWluaW5nIGZpbGUgaXMgc3BlY2lmaWVkLCBvciB0aGUgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBhIGRpZmZlcmVudFxuICAgIC8vICAgICAgIGNvbXBpbGF0aW9uIHVuaXQsIHdlIHVzZSBhIEJhemVsIG1hbmlmZXN0IHBhdGguIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgcG9zc2libGVcbiAgICAvLyAgICAgICBzaW5jZSB3ZSBkb24ndCBoYXZlIGEgY29udGFpbmluZyBmaWxlLCBhbmQgdGhlIHRhcmdldCBmaWxlIGNvdWxkIGJlIGxvY2F0ZWQgaW4gdGhlXG4gICAgLy8gICAgICAgb3V0cHV0IGRpcmVjdG9yeSwgb3IgaW4gYW4gZXh0ZXJuYWwgQmF6ZWwgcmVwb3NpdG9yeS5cbiAgICAvLyAgICAzLiBJZiBib3RoIHJ1bGVzIGFib3ZlIGRpZG4ndCBtYXRjaCwgd2UgY29tcHV0ZSBhIHJlbGF0aXZlIHBhdGggYmV0d2VlbiB0aGUgc291cmNlIGZpbGVzXG4gICAgLy8gICAgICAgc2luY2UgdGhleSBhcmUgcGFydCBvZiB0aGUgc2FtZSBjb21waWxhdGlvbiB1bml0LlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCB3YW50IHRvIGFsd2F5cyB1c2UgKDIpIGJlY2F1c2UgaXQgY291bGQgbWVhbiB0aGF0IGNvbXBpbGF0aW9uIG91dHB1dHNcbiAgICAvLyBhcmUgYWx3YXlzIGxlYWtpbmcgQmF6ZWwtc3BlY2lmaWMgcGF0aHMsIGFuZCB0aGUgb3V0cHV0IGlzIG5vdCBzZWxmLWNvbnRhaW5lZC4gVGhpcyBjb3VsZFxuICAgIC8vIGJyZWFrIGBlc20yMDE1YCBvciBgZXNtNWAgb3V0cHV0IGZvciBBbmd1bGFyIHBhY2thZ2UgcmVsZWFzZSBvdXRwdXRcbiAgICAvLyBPbWl0IHRoZSBgbm9kZV9tb2R1bGVzYCBwcmVmaXggaWYgdGhlIG1vZHVsZSBuYW1lIG9mIGFuIE5QTSBwYWNrYWdlIGlzIHJlcXVlc3RlZC5cbiAgICBpZiAocmVsYXRpdmVUYXJnZXRQYXRoLnN0YXJ0c1dpdGgoTk9ERV9NT0RVTEVTKSkge1xuICAgICAgcmV0dXJuIHJlbGF0aXZlVGFyZ2V0UGF0aC5zdWJzdHIoTk9ERV9NT0RVTEVTLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgY29udGFpbmluZ0ZpbGVQYXRoID09IG51bGwgfHwgIWJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmNsdWRlcyhpbXBvcnRlZEZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG4gICAgY29uc3QgY29udGFpbmluZ0ZpbGVEaXIgPVxuICAgICAgICBwYXRoLmRpcm5hbWUocmVsYXRpdmVUb1Jvb3REaXJzKGNvbnRhaW5pbmdGaWxlUGF0aCwgY29tcGlsZXJPcHRzLnJvb3REaXJzKSk7XG4gICAgY29uc3QgcmVsYXRpdmVJbXBvcnRQYXRoID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShjb250YWluaW5nRmlsZURpciwgcmVsYXRpdmVUYXJnZXRQYXRoKTtcbiAgICByZXR1cm4gcmVsYXRpdmVJbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy4nKSA/IHJlbGF0aXZlSW1wb3J0UGF0aCA6IGAuLyR7cmVsYXRpdmVJbXBvcnRQYXRofWA7XG4gIH1cbn1cbiJdfQ==