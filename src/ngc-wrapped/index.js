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
    exports.patchNgHostWithFileNameToModuleName = exports.maybeWriteUnusedInputsList = exports.compile = exports.relativeToRootDirs = exports.runOneBuild = exports.main = void 0;
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
        if (!bazelHost) {
            bazelHost = new tsc_wrapped_1.CompilerHost(files, compilerOpts, bazelOpts, tsHost, fileLoader);
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
        // Patch fileExists when resolving modules, so that CompilerHost can ask TypeScript to
        // resolve non-existing generated files that don't exist on disk, but are
        // synthetic and added to the `programWithStubs` based on real inputs.
        const origBazelHostFileExist = bazelHost.fileExists;
        bazelHost.fileExists = (fileName) => {
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
        if (!compilerOpts.noEmit) {
            maybeWriteUnusedInputsList(program.getTsProgram(), compilerOpts, bazelOpts);
        }
        return { program, diagnostics };
    }
    exports.compile = compile;
    /**
     * Writes a collection of unused input files and directories which can be
     * consumed by bazel to avoid triggering rebuilds if only unused inputs are
     * changed.
     *
     * See https://bazel.build/contribute/codebase#input-discovery
     */
    function maybeWriteUnusedInputsList(program, options, bazelOpts) {
        if (!(bazelOpts === null || bazelOpts === void 0 ? void 0 : bazelOpts.unusedInputsListPath)) {
            return;
        }
        // ts.Program's getSourceFiles() gets populated by the sources actually
        // loaded while the program is being built.
        const usedFiles = new Set();
        for (const sourceFile of program.getSourceFiles()) {
            // Only concern ourselves with typescript files.
            usedFiles.add(sourceFile.fileName);
        }
        // allowedInputs are absolute paths to files which may also end with /* which
        // implies any files in that directory can be used.
        const unusedInputs = [];
        for (const f of bazelOpts.allowedInputs) {
            // A ts/x file is unused if it was not found directly in the used sources.
            if ((f.endsWith('.ts') || f.endsWith('.tsx')) && !usedFiles.has(f)) {
                unusedInputs.push(f);
                continue;
            }
            // TODO: Iterate over contents of allowed directories checking for used files.
        }
        // Bazel expects the unused input list to contain paths relative to the
        // execroot directory.
        // See https://docs.bazel.build/versions/main/output_directories.html
        fs.writeFileSync(bazelOpts.unusedInputsListPath, unusedInputs.map(f => path.relative(options.rootDir, f)).join('\n'));
    }
    exports.maybeWriteUnusedInputsList = maybeWriteUnusedInputsList;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFFSCxzRkFBc0Y7SUFDdEYsdUZBQXVGO0lBQ3ZGLHNFQUFpUTtJQUdqUSx1Q0FBeUI7SUFDekIsMkNBQTZCO0lBQzdCLDZEQUFtQztJQUNuQyw0REFBNEI7SUFDNUIsNkJBQWtDO0lBV2xDOzs7O09BSUc7SUFDSCxJQUFJLHdCQUF3QixHQUEyQixJQUFJLENBQUM7SUFFNUQsTUFBTSxHQUFHLEdBQUcsa0NBQWtDLENBQUM7SUFDL0MsTUFBTSxhQUFhLEdBQUcsMERBQTBELENBQUM7SUFDakYsMkVBQTJFO0lBQzNFLG1CQUFtQjtJQUNuQixNQUFNLFVBQVUsR0FBRywrQkFBK0IsQ0FBQztJQUVuRCxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQztJQUVwRCw0RUFBNEU7SUFDNUUsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUM7SUFFM0MsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0lBRXJDLFNBQXNCLElBQUksQ0FBQyxJQUFJOztZQUM3QixJQUFJLElBQUEseUJBQVcsRUFBQyxJQUFJLENBQUMsRUFBRTtnQkFDckIsTUFBTSxJQUFBLDJCQUFhLEVBQUMsV0FBVyxDQUFDLENBQUM7YUFDbEM7aUJBQU07Z0JBQ0wsT0FBTyxDQUFBLE1BQU0sV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUN4QztZQUNELE9BQU8sQ0FBQyxDQUFDO1FBQ1gsQ0FBQztLQUFBO0lBUEQsb0JBT0M7SUFFRCx1REFBdUQ7SUFDdkQsTUFBTSxTQUFTLEdBQUcsSUFBSSx1QkFBUyxD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QyxDQUFDLEtBQUssa0JBQWtCLEVBQUUsQ0FBQztRQUM3RixDQUFDO0lBQ0gsQ0FBQztJQS9GRCxrRkErRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8gYHRzYy13cmFwcGVkYCBoZWxwZXJzIGFyZSBub3QgZXhwb3NlZCBpbiB0aGUgcHJpbWFyeSBgQGJhemVsL2NvbmNhdGpzYCBlbnRyeS1wb2ludC5cbi8vIFRPRE86IFVwZGF0ZSB3aGVuIGh0dHBzOi8vZ2l0aHViLmNvbS9iYXplbGJ1aWxkL3J1bGVzX25vZGVqcy9wdWxsLzMyODYgaXMgYXZhaWxhYmxlLlxuaW1wb3J0IHtCYXplbE9wdGlvbnMgYXMgRXh0ZXJuYWxCYXplbE9wdGlvbnMsIENhY2hlZEZpbGVMb2FkZXIsIENvbXBpbGVySG9zdCwgY29uc3RydWN0TWFuaWZlc3QsIGRlYnVnLCBGaWxlQ2FjaGUsIEZpbGVMb2FkZXIsIHBhcnNlVHNjb25maWcsIHJlc29sdmVOb3JtYWxpemVkUGF0aCwgcnVuQXNXb3JrZXIsIHJ1bldvcmtlckxvb3AsIFVuY2FjaGVkRmlsZUxvYWRlcn0gZnJvbSAnQGJhemVsL2NvbmNhdGpzL2ludGVybmFsL3RzY193cmFwcGVkJztcblxuaW1wb3J0IHR5cGUge0FuZ3VsYXJDb21waWxlck9wdGlvbnMsIENvbXBpbGVySG9zdCBhcyBOZ0NvbXBpbGVySG9zdCwgVHNFbWl0Q2FsbGJhY2ssIFByb2dyYW0sIENvbXBpbGVyT3B0aW9uc30gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB0c2lja2xlIGZyb20gJ3RzaWNrbGUnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtwYXRoVG9GaWxlVVJMfSBmcm9tICd1cmwnO1xuXG50eXBlIENvbXBpbGVyQ2xpTW9kdWxlID1cbiAgICB0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKSZ0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCcpO1xuXG4vLyBBZGQgZGV2bW9kZSBmb3IgYmxhemUgaW50ZXJuYWxcbmludGVyZmFjZSBCYXplbE9wdGlvbnMgZXh0ZW5kcyBFeHRlcm5hbEJhemVsT3B0aW9ucyB7XG4gIGFsbG93ZWRJbnB1dHM/OiBzdHJpbmdbXTtcbiAgdW51c2VkSW5wdXRzTGlzdFBhdGg/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIHRoZSBwcmV2aW91c2x5IGxvYWRlZCBgY29tcGlsZXItY2xpYCBtb2R1bGUgZXhwb3J0cy4gV2UgY2FjaGUgdGhlIGV4cG9ydHNcbiAqIGFzIGBuZ2Mtd3JhcHBlZGAgY2FuIHJ1biBhcyBwYXJ0IG9mIGEgd29ya2VyIHdoZXJlIHRoZSBBbmd1bGFyIGNvbXBpbGVyIHNob3VsZCBub3QgYmVcbiAqIHJlc29sdmVkIHRocm91Z2ggYSBkeW5hbWljIGltcG9ydCBmb3IgZXZlcnkgYnVpbGQuXG4gKi9cbmxldCBfY2FjaGVkQ29tcGlsZXJDbGlNb2R1bGU6IENvbXBpbGVyQ2xpTW9kdWxlfG51bGwgPSBudWxsO1xuXG5jb25zdCBFWFQgPSAvKFxcLnRzfFxcLmRcXC50c3xcXC5qc3xcXC5qc3h8XFwudHN4KSQvO1xuY29uc3QgTkdDX0dFTl9GSUxFUyA9IC9eKC4qPylcXC4obmdmYWN0b3J5fG5nc3VtbWFyeXxuZ3N0eWxlfHNoaW1cXC5uZ3N0eWxlKSguKikkLztcbi8vIEZJWE1FOiB3ZSBzaG91bGQgYmUgYWJsZSB0byBhZGQgdGhlIGFzc2V0cyB0byB0aGUgdHNjb25maWcgc28gRmlsZUxvYWRlclxuLy8ga25vd3MgYWJvdXQgdGhlbVxuY29uc3QgTkdDX0FTU0VUUyA9IC9cXC4oY3NzfGh0bWx8bmdzdW1tYXJ5XFwuanNvbikkLztcblxuY29uc3QgQkFaRUxfQklOID0gL1xcYihibGF6ZXxiYXplbCktb3V0XFxiLio/XFxiYmluXFxiLztcblxuLy8gTm90ZTogV2UgY29tcGlsZSB0aGUgY29udGVudCBvZiBub2RlX21vZHVsZXMgd2l0aCBwbGFpbiBuZ2MgY29tbWFuZCBsaW5lLlxuY29uc3QgQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCA9IGZhbHNlO1xuXG5jb25zdCBOT0RFX01PRFVMRVMgPSAnbm9kZV9tb2R1bGVzLyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYWluKGFyZ3MpIHtcbiAgaWYgKHJ1bkFzV29ya2VyKGFyZ3MpKSB7XG4gICAgYXdhaXQgcnVuV29ya2VyTG9vcChydW5PbmVCdWlsZCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGF3YWl0IHJ1bk9uZUJ1aWxkKGFyZ3MpID8gMCA6IDE7XG4gIH1cbiAgcmV0dXJuIDA7XG59XG5cbi8qKiBUaGUgb25lIEZpbGVDYWNoZSBpbnN0YW5jZSB1c2VkIGluIHRoaXMgcHJvY2Vzcy4gKi9cbmNvbnN0IGZpbGVDYWNoZSA9IG5ldyBGaWxlQ2FjaGU8dHMuU291cmNlRmlsZT4oZGVidWcpO1xuXG4vKipcbiAqIExvYWRzIGEgbW9kdWxlIHRoYXQgY2FuIGVpdGhlciBiZSBDb21tb25KUyBvciBhbiBFU01vZHVsZS4gVGhpcyBpcyBkb25lXG4gKiBhcyBpbnRlcm9wIHdpdGggdGhlIGN1cnJlbnQgZGV2bW9kZSBDb21tb25KUyBhbmQgcHJvZG1vZGUgRVNNIG91dHB1dC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gbG9hZE1vZHVsZUludGVyb3A8VD4obW9kdWxlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxUPiB7XG4gIC8vIE5vdGU6IFRoaXMgYXNzdW1lcyB0aGF0IHRoZXJlIGFyZSBubyBjb25kaXRpb25hbCBleHBvcnRzIHN3aXRjaGluZyBiZXR3ZWVuIGBpbXBvcnRgXG4gIC8vIG9yIGByZXF1aXJlYC4gV2UgY2Fubm90IGZ1bGx5IHJlbHkgb24gdGhlIGR5bmFtaWMgaW1wb3J0IGV4cHJlc3Npb24gaGVyZSBiZWNhdXNlIHRoZVxuICAvLyBCYXplbCBOb2RlSlMgcnVsZXMgZG8gbm90IHBhdGNoIHRoZSBgaW1wb3J0YCBOb2RlSlMgbW9kdWxlIHJlc29sdXRpb24sIGFuZCB0aGlzIHdvdWxkXG4gIC8vIG1ha2UgbmdjLXdyYXBwZWQgZGVwZW5kZW50IG9uIHRoZSBsaW5rZXIuIFRoZSBsaW5rZXIgaXMgbm90IGVuYWJsZWQgd2hlbiB0aGUgYG5nYy13cmFwcGVkYFxuICAvLyBiaW5hcnkgaXMgc2hpcHBlZCBpbiB0aGUgTlBNIHBhY2thZ2UgYW5kIGlzIG5vdCBhdmFpbGFibGUgaW4gR29vZ2xlMyBlaXRoZXIuXG4gIGNvbnN0IHJlc29sdmVkVXJsID0gcGF0aFRvRmlsZVVSTChyZXF1aXJlLnJlc29sdmUobW9kdWxlTmFtZSkpO1xuICBjb25zdCBleHBvcnRzOiBQYXJ0aWFsPFQ+JntkZWZhdWx0PzogVH0gPVxuICAgICAgYXdhaXQgbmV3IEZ1bmN0aW9uKCdtJywgYHJldHVybiBpbXBvcnQobSk7YCkocmVzb2x2ZWRVcmwpO1xuICByZXR1cm4gZXhwb3J0cy5kZWZhdWx0ID8/IGV4cG9ydHMgYXMgVDtcbn1cblxuLyoqXG4gKiBGZXRjaGVzIHRoZSBBbmd1bGFyIGNvbXBpbGVyIENMSSBtb2R1bGUgZHluYW1pY2FsbHksIGFsbG93aW5nIGZvciBhbiBFU01cbiAqIHZhcmlhbnQgb2YgdGhlIGNvbXBpbGVyLlxuICovXG5hc3luYyBmdW5jdGlvbiBmZXRjaENvbXBpbGVyQ2xpTW9kdWxlKCk6IFByb21pc2U8Q29tcGlsZXJDbGlNb2R1bGU+IHtcbiAgaWYgKF9jYWNoZWRDb21waWxlckNsaU1vZHVsZSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBfY2FjaGVkQ29tcGlsZXJDbGlNb2R1bGU7XG4gIH1cblxuICAvLyBOb3RlOiBXZSBsb2FkIHRoZSBjb21waWxlci1jbGkgcGFja2FnZSBkeW5hbWljYWxseSB1c2luZyBgbG9hZE1vZHVsZUludGVyb3BgIGFzXG4gIC8vIHRoaXMgc2NyaXB0IHJ1bnMgYXMgQ29tbW9uSlMgbW9kdWxlIGJ1dCB0aGUgY29tcGlsZXItY2xpIGNvdWxkIGJlIGJ1aWx0IGFzIHN0cmljdCBFU01cbiAgLy8gcGFja2FnZS4gVW5mb3J0dW5hdGVseSB3ZSBoYXZlIGEgbWl4IG9mIENvbW1vbkpTIGFuZCBFU00gb3V0cHV0IGhlcmUgYmVjYXVzZSB0aGUgZGV2bW9kZVxuICAvLyBvdXRwdXQgaXMgc3RpbGwgdXNpbmcgQ29tbW9uSlMgYW5kIHRoaXMgaXMgcHJpbWFyaWx5IHVzZWQgZm9yIHRlc3RpbmcuIEFsc28gaW5zaWRlIEczLFxuICAvLyB0aGUgZGV2bW9kZSBvdXRwdXQgd2lsbCByZW1haW4gQ29tbW9uSlMgcmVnYXJkbGVzcyBmb3Igbm93LlxuICAvLyBUT0RPOiBGaXggdGhpcyB1cCBvbmNlIGRldm1vZGUgYW5kIHByb2Rtb2RlIGFyZSBjb21iaW5lZCBhbmQgd2UgdXNlIEVTTSBldmVyeXdoZXJlLlxuICBjb25zdCBjb21waWxlckV4cG9ydHMgPVxuICAgICAgYXdhaXQgbG9hZE1vZHVsZUludGVyb3A8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcbiAgY29uc3QgY29tcGlsZXJQcml2YXRlRXhwb3J0cyA9XG4gICAgICBhd2FpdCBsb2FkTW9kdWxlSW50ZXJvcDx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvcHJpdmF0ZS9iYXplbCcpPihcbiAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL3ByaXZhdGUvYmF6ZWwnKTtcbiAgcmV0dXJuIF9jYWNoZWRDb21waWxlckNsaU1vZHVsZSA9IHsuLi5jb21waWxlckV4cG9ydHMsIC4uLmNvbXBpbGVyUHJpdmF0ZUV4cG9ydHN9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuT25lQnVpbGQoXG4gICAgYXJnczogc3RyaW5nW10sIGlucHV0cz86IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoYXJnc1swXSA9PT0gJy1wJykge1xuICAgIGFyZ3Muc2hpZnQoKTtcbiAgfVxuXG4gIC8vIFN0cmlwIGxlYWRpbmcgYXQtc2lnbnMsIHVzZWQgdG8gaW5kaWNhdGUgYSBwYXJhbXMgZmlsZVxuICBjb25zdCBwcm9qZWN0ID0gYXJnc1swXS5yZXBsYWNlKC9eQCsvLCAnJyk7XG4gIGNvbnN0IG5nID0gYXdhaXQgZmV0Y2hDb21waWxlckNsaU1vZHVsZSgpO1xuXG4gIGNvbnN0IFtwYXJzZWRPcHRpb25zLCBlcnJvcnNdID0gcGFyc2VUc2NvbmZpZyhwcm9qZWN0KTtcbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihuZy5mb3JtYXREaWFnbm9zdGljcyhlcnJvcnMpKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB7YmF6ZWxPcHRzLCBvcHRpb25zOiB0c09wdGlvbnMsIGZpbGVzLCBjb25maWd9ID0gcGFyc2VkT3B0aW9ucztcbiAgY29uc3Qge2Vycm9yczogdXNlckVycm9ycywgb3B0aW9uczogdXNlck9wdGlvbnN9ID0gbmcucmVhZENvbmZpZ3VyYXRpb24ocHJvamVjdCk7XG5cbiAgaWYgKHVzZXJFcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IobmcuZm9ybWF0RGlhZ25vc3RpY3ModXNlckVycm9ycykpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGFsbG93ZWROZ0NvbXBpbGVyT3B0aW9uc092ZXJyaWRlcyA9IG5ldyBTZXQ8c3RyaW5nPihbXG4gICAgJ2RpYWdub3N0aWNzJyxcbiAgICAndHJhY2UnLFxuICAgICdkaXNhYmxlRXhwcmVzc2lvbkxvd2VyaW5nJyxcbiAgICAnZGlzYWJsZVR5cGVTY3JpcHRWZXJzaW9uQ2hlY2snLFxuICAgICdpMThuT3V0TG9jYWxlJyxcbiAgICAnaTE4bk91dEZvcm1hdCcsXG4gICAgJ2kxOG5PdXRGaWxlJyxcbiAgICAnaTE4bkluTG9jYWxlJyxcbiAgICAnaTE4bkluRmlsZScsXG4gICAgJ2kxOG5JbkZvcm1hdCcsXG4gICAgJ2kxOG5Vc2VFeHRlcm5hbElkcycsXG4gICAgJ2kxOG5Jbk1pc3NpbmdUcmFuc2xhdGlvbnMnLFxuICAgICdwcmVzZXJ2ZVdoaXRlc3BhY2VzJyxcbiAgICAnY3JlYXRlRXh0ZXJuYWxTeW1ib2xGYWN0b3J5UmVleHBvcnRzJyxcbiAgXSk7XG5cbiAgY29uc3QgdXNlck92ZXJyaWRlcyA9IE9iamVjdC5lbnRyaWVzKHVzZXJPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXldKSA9PiBhbGxvd2VkTmdDb21waWxlck9wdGlvbnNPdmVycmlkZXMuaGFzKGtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlZHVjZSgob2JqLCBba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwge30pO1xuXG4gIGNvbnN0IGNvbXBpbGVyT3B0czogQW5ndWxhckNvbXBpbGVyT3B0aW9ucyA9IHtcbiAgICAuLi51c2VyT3ZlcnJpZGVzLFxuICAgIC4uLmNvbmZpZ1snYW5ndWxhckNvbXBpbGVyT3B0aW9ucyddLFxuICAgIC4uLnRzT3B0aW9ucyxcbiAgfTtcblxuICAvLyBUaGVzZSBhcmUgb3B0aW9ucyBwYXNzZWQgdGhyb3VnaCBmcm9tIHRoZSBgbmdfbW9kdWxlYCBydWxlIHdoaWNoIGFyZW4ndCBzdXBwb3J0ZWRcbiAgLy8gYnkgdGhlIGBAYW5ndWxhci9jb21waWxlci1jbGlgIGFuZCBhcmUgb25seSBpbnRlbmRlZCBmb3IgYG5nYy13cmFwcGVkYC5cbiAgY29uc3Qge2V4cGVjdGVkT3V0LCBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZX0gPSBjb25maWdbJ2FuZ3VsYXJDb21waWxlck9wdGlvbnMnXTtcblxuICBjb25zdCB0c0hvc3QgPSB0cy5jcmVhdGVDb21waWxlckhvc3QoY29tcGlsZXJPcHRzLCB0cnVlKTtcbiAgY29uc3Qge2RpYWdub3N0aWNzfSA9IGNvbXBpbGUoe1xuICAgIGFsbERlcHNDb21waWxlZFdpdGhCYXplbDogQUxMX0RFUFNfQ09NUElMRURfV0lUSF9CQVpFTCxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBfdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSxcbiAgICBleHBlY3RlZE91dHM6IGV4cGVjdGVkT3V0LFxuICAgIGNvbXBpbGVyT3B0cyxcbiAgICB0c0hvc3QsXG4gICAgYmF6ZWxPcHRzLFxuICAgIGZpbGVzLFxuICAgIGlucHV0cyxcbiAgICBuZyxcbiAgfSk7XG4gIGlmIChkaWFnbm9zdGljcy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKG5nLmZvcm1hdERpYWdub3N0aWNzKGRpYWdub3N0aWNzKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzLmV2ZXJ5KGQgPT4gZC5jYXRlZ29yeSAhPT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlUGF0aDogc3RyaW5nLCByb290RGlyczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gZmlsZVBhdGg7XG4gIC8vIE5COiB0aGUgcm9vdERpcnMgc2hvdWxkIGhhdmUgYmVlbiBzb3J0ZWQgbG9uZ2VzdC1maXJzdFxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3REaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZGlyID0gcm9vdERpcnNbaV07XG4gICAgY29uc3QgcmVsID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShkaXIsIGZpbGVQYXRoKTtcbiAgICBpZiAocmVsLmluZGV4T2YoJy4nKSAhPSAwKSByZXR1cm4gcmVsO1xuICB9XG4gIHJldHVybiBmaWxlUGF0aDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGUoe1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwgPSB0cnVlLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lLFxuICBjb21waWxlck9wdHMsXG4gIHRzSG9zdCxcbiAgYmF6ZWxPcHRzLFxuICBmaWxlcyxcbiAgaW5wdXRzLFxuICBleHBlY3RlZE91dHMsXG4gIGdhdGhlckRpYWdub3N0aWNzLFxuICBiYXplbEhvc3QsXG4gIG5nLFxufToge1xuICBhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWw/OiBib29sZWFuLFxuICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lPzogYm9vbGVhbiwgY29tcGlsZXJPcHRzOiBDb21waWxlck9wdGlvbnMsIHRzSG9zdDogdHMuQ29tcGlsZXJIb3N0LFxuICBpbnB1dHM/OiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sXG4gICAgICAgIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLFxuICAgICAgICBmaWxlczogc3RyaW5nW10sXG4gICAgICAgIGV4cGVjdGVkT3V0czogc3RyaW5nW10sXG4gIGdhdGhlckRpYWdub3N0aWNzPzogKHByb2dyYW06IFByb2dyYW0pID0+IHJlYWRvbmx5IHRzLkRpYWdub3N0aWNbXSxcbiAgYmF6ZWxIb3N0PzogQ29tcGlsZXJIb3N0LCBuZzogQ29tcGlsZXJDbGlNb2R1bGUsXG59KToge2RpYWdub3N0aWNzOiByZWFkb25seSB0cy5EaWFnbm9zdGljW10sIHByb2dyYW06IFByb2dyYW19IHtcbiAgbGV0IGZpbGVMb2FkZXI6IEZpbGVMb2FkZXI7XG5cbiAgaWYgKGJhemVsT3B0cy5tYXhDYWNoZVNpemVNYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbWF4Q2FjaGVTaXplQnl0ZXMgPSBiYXplbE9wdHMubWF4Q2FjaGVTaXplTWIgKiAoMSA8PCAyMCk7XG4gICAgZmlsZUNhY2hlLnNldE1heENhY2hlU2l6ZShtYXhDYWNoZVNpemVCeXRlcyk7XG4gIH0gZWxzZSB7XG4gICAgZmlsZUNhY2hlLnJlc2V0TWF4Q2FjaGVTaXplKCk7XG4gIH1cblxuICBpZiAoaW5wdXRzKSB7XG4gICAgZmlsZUxvYWRlciA9IG5ldyBDYWNoZWRGaWxlTG9hZGVyKGZpbGVDYWNoZSk7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaW5wdXRzIHRvIGFic29sdXRlIHBhdGhzIHRvIG1hdGNoIFR5cGVTY3JpcHQgaW50ZXJuYWxzXG4gICAgY29uc3QgcmVzb2x2ZWRJbnB1dHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGlucHV0S2V5cyA9IE9iamVjdC5rZXlzKGlucHV0cyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGlucHV0S2V5c1tpXTtcbiAgICAgIHJlc29sdmVkSW5wdXRzLnNldChyZXNvbHZlTm9ybWFsaXplZFBhdGgoa2V5KSwgaW5wdXRzW2tleV0pO1xuICAgIH1cbiAgICBmaWxlQ2FjaGUudXBkYXRlQ2FjaGUocmVzb2x2ZWRJbnB1dHMpO1xuICB9IGVsc2Uge1xuICAgIGZpbGVMb2FkZXIgPSBuZXcgVW5jYWNoZWRGaWxlTG9hZGVyKCk7XG4gIH1cblxuICAvLyBEZXRlY3QgZnJvbSBjb21waWxlck9wdHMgd2hldGhlciB0aGUgZW50cnlwb2ludCBpcyBiZWluZyBpbnZva2VkIGluIEl2eSBtb2RlLlxuICBjb25zdCBpc0luSXZ5TW9kZSA9ICEhY29tcGlsZXJPcHRzLmVuYWJsZUl2eTtcbiAgaWYgKCFjb21waWxlck9wdHMucm9vdERpcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jvb3REaXJzIGlzIG5vdCBzZXQhJyk7XG4gIH1cbiAgY29uc3QgYmF6ZWxCaW4gPSBjb21waWxlck9wdHMucm9vdERpcnMuZmluZChyb290RGlyID0+IEJBWkVMX0JJTi50ZXN0KHJvb3REaXIpKTtcbiAgaWYgKCFiYXplbEJpbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBiYXplbCBiaW4gaW4gdGhlIHJvb3REaXJzOiAke2NvbXBpbGVyT3B0cy5yb290RGlyc31gKTtcbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkT3V0c1NldCA9IG5ldyBTZXQoZXhwZWN0ZWRPdXRzLm1hcChwID0+IGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgocCkpKTtcblxuICBjb25zdCBvcmlnaW5hbFdyaXRlRmlsZSA9IHRzSG9zdC53cml0ZUZpbGUuYmluZCh0c0hvc3QpO1xuICB0c0hvc3Qud3JpdGVGaWxlID1cbiAgICAgIChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcsIHdyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgICBvbkVycm9yPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCwgc291cmNlRmlsZXM/OiB0cy5Tb3VyY2VGaWxlW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmUgPVxuICAgICAgICAgICAgcmVsYXRpdmVUb1Jvb3REaXJzKGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZU5hbWUpLCBbY29tcGlsZXJPcHRzLnJvb3REaXJdKTtcbiAgICAgICAgaWYgKGV4cGVjdGVkT3V0c1NldC5oYXMocmVsYXRpdmUpKSB7XG4gICAgICAgICAgZXhwZWN0ZWRPdXRzU2V0LmRlbGV0ZShyZWxhdGl2ZSk7XG4gICAgICAgICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsIGNvbnRlbnQsIHdyaXRlQnl0ZU9yZGVyTWFyaywgb25FcnJvciwgc291cmNlRmlsZXMpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gIGlmICghYmF6ZWxIb3N0KSB7XG4gICAgYmF6ZWxIb3N0ID0gbmV3IENvbXBpbGVySG9zdChmaWxlcywgY29tcGlsZXJPcHRzLCBiYXplbE9wdHMsIHRzSG9zdCwgZmlsZUxvYWRlcik7XG4gIH1cblxuICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcuYmluZChiYXplbEhvc3QpO1xuICAgIGJhemVsSG9zdC5zaG91bGRTa2lwVHNpY2tsZVByb2Nlc3NpbmcgPSAoZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgLy8gVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2Ygc2hvdWxkU2tpcFRzaWNrbGVQcm9jZXNzaW5nIGNoZWNrcyB3aGV0aGVyIGBmaWxlTmFtZWAgaXMgcGFydCBvZlxuICAgICAgLy8gdGhlIG9yaWdpbmFsIGBzcmNzW11gLiBGb3IgQW5ndWxhciAoSXZ5KSBjb21waWxhdGlvbnMsIG5nZmFjdG9yeS9uZ3N1bW1hcnkgZmlsZXMgdGhhdCBhcmVcbiAgICAgIC8vIHNoaW1zIGZvciBvcmlnaW5hbCAudHMgZmlsZXMgaW4gdGhlIHByb2dyYW0gc2hvdWxkIGJlIHRyZWF0ZWQgaWRlbnRpY2FsbHkuIFRodXMsIHN0cmlwIHRoZVxuICAgICAgLy8gJy5uZ2ZhY3RvcnknIG9yICcubmdzdW1tYXJ5JyBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBhd2F5IGJlZm9yZSBjYWxsaW5nIHRoZSBkZWxlZ2F0ZS5cbiAgICAgIHJldHVybiBkZWxlZ2F0ZShmaWxlTmFtZS5yZXBsYWNlKC9cXC4obmdmYWN0b3J5fG5nc3VtbWFyeSlcXC50cyQvLCAnLnRzJykpO1xuICAgIH07XG4gIH1cblxuICAvLyBCeSBkZWZhdWx0LCBkaXNhYmxlIHRzaWNrbGUgZGVjb3JhdG9yIHRyYW5zZm9ybWluZyBpbiB0aGUgdHNpY2tsZSBjb21waWxlciBob3N0LlxuICAvLyBUaGUgQW5ndWxhciBjb21waWxlcnMgaGF2ZSB0aGVpciBvd24gbG9naWMgZm9yIGRlY29yYXRvciBwcm9jZXNzaW5nIGFuZCB3ZSB3b3VsZG4ndFxuICAvLyB3YW50IHRzaWNrbGUgdG8gaW50ZXJmZXJlIHdpdGggdGhhdC5cbiAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSBmYWxzZTtcblxuICAvLyBCeSBkZWZhdWx0IGluIHRoZSBgcHJvZG1vZGVgIG91dHB1dCwgd2UgZG8gbm90IGFkZCBhbm5vdGF0aW9ucyBmb3IgY2xvc3VyZSBjb21waWxlci5cbiAgLy8gVGhvdWdoLCBpZiB3ZSBhcmUgYnVpbGRpbmcgaW5zaWRlIGBnb29nbGUzYCwgY2xvc3VyZSBhbm5vdGF0aW9ucyBhcmUgZGVzaXJlZCBmb3JcbiAgLy8gcHJvZG1vZGUgb3V0cHV0LCBzbyB3ZSBlbmFibGUgaXQgYnkgZGVmYXVsdC4gVGhlIGRlZmF1bHRzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gIC8vIHNldHRpbmcgdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgY29tcGlsZXIgb3B0aW9uIGluIHRoZSB1c2VyIHRzY29uZmlnLlxuICBpZiAoIWJhemVsT3B0cy5lczVNb2RlICYmICFiYXplbE9wdHMuZGV2bW9kZSkge1xuICAgIGlmIChiYXplbE9wdHMud29ya3NwYWNlTmFtZSA9PT0gJ2dvb2dsZTMnKSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSB0cnVlO1xuICAgICAgLy8gRW5hYmxlIHRoZSB0c2lja2xlIGRlY29yYXRvciB0cmFuc2Zvcm0gaW4gZ29vZ2xlMyB3aXRoIEl2eSBtb2RlIGVuYWJsZWQuIFRoZSB0c2lja2xlXG4gICAgICAvLyBkZWNvcmF0b3IgdHJhbnNmb3JtYXRpb24gaXMgc3RpbGwgbmVlZGVkLiBUaGlzIG1pZ2h0IGJlIGJlY2F1c2Ugb2YgY3VzdG9tIGRlY29yYXRvcnNcbiAgICAgIC8vIHdpdGggdGhlIGBAQW5ub3RhdGlvbmAgSlNEb2MgdGhhdCB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGUgdHNpY2tsZSBkZWNvcmF0b3IgdHJhbnNmb3JtLlxuICAgICAgLy8gVE9ETzogRmlndXJlIG91dCB3aHkgdGhpcyBpcyBuZWVkZWQgaW4gZzMgYW5kIGhvdyB3ZSBjYW4gaW1wcm92ZSB0aGlzLiBGVy0yMjI1XG4gICAgICBpZiAoaXNJbkl2eU1vZGUpIHtcbiAgICAgICAgYmF6ZWxIb3N0LnRyYW5zZm9ybURlY29yYXRvcnMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb21waWxlck9wdHMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBUaGUgYGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyYCBBbmd1bGFyIGNvbXBpbGVyIG9wdGlvbiBpcyBub3QgcmVzcGVjdGVkIGJ5IGRlZmF1bHRcbiAgLy8gYXMgbmdjLXdyYXBwZWQgaGFuZGxlcyB0c2lja2xlIGVtaXQgb24gaXRzIG93bi4gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gdXBkYXRlXG4gIC8vIHRoZSB0c2lja2xlIGNvbXBpbGVyIGhvc3QgYmFzZWQgb24gdGhlIGBhbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcmAgZmxhZy5cbiAgaWYgKGNvbXBpbGVyT3B0cy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlcikge1xuICAgIGJhemVsSG9zdC50cmFuc2Zvcm1UeXBlc1RvQ2xvc3VyZSA9IHRydWU7XG4gIH1cblxuICAvLyBQYXRjaCBmaWxlRXhpc3RzIHdoZW4gcmVzb2x2aW5nIG1vZHVsZXMsIHNvIHRoYXQgQ29tcGlsZXJIb3N0IGNhbiBhc2sgVHlwZVNjcmlwdCB0b1xuICAvLyByZXNvbHZlIG5vbi1leGlzdGluZyBnZW5lcmF0ZWQgZmlsZXMgdGhhdCBkb24ndCBleGlzdCBvbiBkaXNrLCBidXQgYXJlXG4gIC8vIHN5bnRoZXRpYyBhbmQgYWRkZWQgdG8gdGhlIGBwcm9ncmFtV2l0aFN0dWJzYCBiYXNlZCBvbiByZWFsIGlucHV0cy5cbiAgY29uc3Qgb3JpZ0JhemVsSG9zdEZpbGVFeGlzdCA9IGJhemVsSG9zdC5maWxlRXhpc3RzO1xuICBiYXplbEhvc3QuZmlsZUV4aXN0cyA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBOR0NfR0VOX0ZJTEVTLmV4ZWMoZmlsZU5hbWUpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZSwgc3VmZml4LCBleHRdID0gbWF0Y2g7XG4gICAgICAvLyBQZXJmb3JtYW5jZTogc2tpcCBsb29raW5nIGZvciBmaWxlcyBvdGhlciB0aGFuIC5kLnRzIG9yIC50c1xuICAgICAgaWYgKGV4dCAhPT0gJy50cycgJiYgZXh0ICE9PSAnLmQudHMnKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VmZml4LmluZGV4T2YoJ25nc3R5bGUnKSA+PSAwKSB7XG4gICAgICAgIC8vIExvb2sgZm9yIGZvby5jc3Mgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMb29rIGZvciBmb28uZC50cyBvciBmb28udHMgb24gZGlza1xuICAgICAgICBmaWxlTmFtZSA9IGZpbGUgKyAoZXh0IHx8ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKE5HQ19BU1NFVFMudGVzdChmaWxlTmFtZSkpIHtcbiAgICAgIHJldHVybiB0c0hvc3QuZmlsZUV4aXN0cyhmaWxlTmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0RmlsZUV4aXN0LmNhbGwoYmF6ZWxIb3N0LCBmaWxlTmFtZSk7XG4gIH07XG4gIGNvbnN0IG9yaWdCYXplbEhvc3RTaG91bGROYW1lTW9kdWxlID0gYmF6ZWxIb3N0LnNob3VsZE5hbWVNb2R1bGUuYmluZChiYXplbEhvc3QpO1xuICBiYXplbEhvc3Quc2hvdWxkTmFtZU1vZHVsZSA9IChmaWxlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZmxhdE1vZHVsZU91dFBhdGggPVxuICAgICAgICBwYXRoLnBvc2l4LmpvaW4oYmF6ZWxPcHRzLnBhY2thZ2UsIGNvbXBpbGVyT3B0cy5mbGF0TW9kdWxlT3V0RmlsZSArICcudHMnKTtcblxuICAgIC8vIFRoZSBidW5kbGUgaW5kZXggZmlsZSBpcyBzeW50aGVzaXplZCBpbiBidW5kbGVfaW5kZXhfaG9zdCBzbyBpdCdzIG5vdCBpbiB0aGVcbiAgICAvLyBjb21waWxhdGlvblRhcmdldFNyYy5cbiAgICAvLyBIb3dldmVyIHdlIHN0aWxsIHdhbnQgdG8gZ2l2ZSBpdCBhbiBBTUQgbW9kdWxlIG5hbWUgZm9yIGRldm1vZGUuXG4gICAgLy8gV2UgY2FuJ3QgZWFzaWx5IHRlbGwgd2hpY2ggZmlsZSBpcyB0aGUgc3ludGhldGljIG9uZSwgc28gd2UgYnVpbGQgdXAgdGhlIHBhdGggd2UgZXhwZWN0XG4gICAgLy8gaXQgdG8gaGF2ZSBhbmQgY29tcGFyZSBhZ2FpbnN0IHRoYXQuXG4gICAgaWYgKGZpbGVOYW1lID09PSBwYXRoLnBvc2l4LmpvaW4oY29tcGlsZXJPcHRzLmJhc2VVcmwsIGZsYXRNb2R1bGVPdXRQYXRoKSkgcmV0dXJuIHRydWU7XG5cbiAgICAvLyBBbHNvIGhhbmRsZSB0aGUgY2FzZSB0aGUgdGFyZ2V0IGlzIGluIGFuIGV4dGVybmFsIHJlcG9zaXRvcnkuXG4gICAgLy8gUHVsbCB0aGUgd29ya3NwYWNlIG5hbWUgZnJvbSB0aGUgdGFyZ2V0IHdoaWNoIGlzIGZvcm1hdHRlZCBhcyBgQHdrc3AvL3BhY2thZ2U6dGFyZ2V0YFxuICAgIC8vIGlmIGl0IHRoZSB0YXJnZXQgaXMgZnJvbSBhbiBleHRlcm5hbCB3b3Jrc3BhY2UuIElmIHRoZSB0YXJnZXQgaXMgZnJvbSB0aGUgbG9jYWxcbiAgICAvLyB3b3Jrc3BhY2UgdGhlbiBpdCB3aWxsIGJlIGZvcm1hdHRlZCBhcyBgLy9wYWNrYWdlOnRhcmdldGAuXG4gICAgY29uc3QgdGFyZ2V0V29ya3NwYWNlID0gYmF6ZWxPcHRzLnRhcmdldC5zcGxpdCgnLycpWzBdLnJlcGxhY2UoL15ALywgJycpO1xuXG4gICAgaWYgKHRhcmdldFdvcmtzcGFjZSAmJlxuICAgICAgICBmaWxlTmFtZSA9PT1cbiAgICAgICAgICAgIHBhdGgucG9zaXguam9pbihjb21waWxlck9wdHMuYmFzZVVybCwgJ2V4dGVybmFsJywgdGFyZ2V0V29ya3NwYWNlLCBmbGF0TW9kdWxlT3V0UGF0aCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBvcmlnQmF6ZWxIb3N0U2hvdWxkTmFtZU1vZHVsZShmaWxlTmFtZSkgfHwgTkdDX0dFTl9GSUxFUy50ZXN0KGZpbGVOYW1lKTtcbiAgfTtcblxuICBjb25zdCBuZ0hvc3QgPSBuZy5jcmVhdGVDb21waWxlckhvc3Qoe29wdGlvbnM6IGNvbXBpbGVyT3B0cywgdHNIb3N0OiBiYXplbEhvc3R9KTtcbiAgcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgICBuZ0hvc3QsIGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lKTtcblxuICBuZ0hvc3QudG9TdW1tYXJ5RmlsZU5hbWUgPSAoZmlsZU5hbWU6IHN0cmluZywgcmVmZXJyaW5nU3JjRmlsZU5hbWU6IHN0cmluZykgPT4gcGF0aC5wb3NpeC5qb2luKFxuICAgICAgYmF6ZWxPcHRzLndvcmtzcGFjZU5hbWUsXG4gICAgICByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZU5hbWUsIGNvbXBpbGVyT3B0cy5yb290RGlycykucmVwbGFjZShFWFQsICcnKSk7XG4gIGlmIChhbGxEZXBzQ29tcGlsZWRXaXRoQmF6ZWwpIHtcbiAgICAvLyBOb3RlOiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3b3VsZCB3b3JrIGFzIHdlbGwsXG4gICAgLy8gYnV0IHdlIGNhbiBiZSBmYXN0ZXIgYXMgd2Uga25vdyBob3cgYHRvU3VtbWFyeUZpbGVOYW1lYCB3b3Jrcy5cbiAgICAvLyBOb3RlOiBXZSBjYW4ndCBkbyB0aGlzIGlmIHNvbWUgZGVwcyBoYXZlIGJlZW4gY29tcGlsZWQgd2l0aCB0aGUgY29tbWFuZCBsaW5lLFxuICAgIC8vIGFzIHRoYXQgaGFzIGEgZGlmZmVyZW50IGltcGxlbWVudGF0aW9uIG9mIGZyb21TdW1tYXJ5RmlsZU5hbWUgLyB0b1N1bW1hcnlGaWxlTmFtZVxuICAgIG5nSG9zdC5mcm9tU3VtbWFyeUZpbGVOYW1lID0gKGZpbGVOYW1lOiBzdHJpbmcsIHJlZmVycmluZ0xpYkZpbGVOYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJlbGF0aXZlID0gZmlsZU5hbWUuc3BsaXQoJy8nKS5zcGxpY2UoMSkuam9pbignLycpO1xuICAgICAgcmV0dXJuIHJlc29sdmVOb3JtYWxpemVkUGF0aChiYXplbEJpbiwgd29ya3NwYWNlUmVsYXRpdmUpICsgJy5kLnRzJztcbiAgICB9O1xuICB9XG4gIC8vIFBhdGNoIGEgcHJvcGVydHkgb24gdGhlIG5nSG9zdCB0aGF0IGFsbG93cyB0aGUgcmVzb3VyY2VOYW1lVG9Nb2R1bGVOYW1lIGZ1bmN0aW9uIHRvXG4gIC8vIHJlcG9ydCBiZXR0ZXIgZXJyb3JzLlxuICAobmdIb3N0IGFzIGFueSkucmVwb3J0TWlzc2luZ1Jlc291cmNlID0gKHJlc291cmNlTmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuQXNzZXQgbm90IGZvdW5kOlxcbiAgJHtyZXNvdXJjZU5hbWV9YCk7XG4gICAgY29uc29sZS5lcnJvcignQ2hlY2sgdGhhdCBpdFxcJ3MgaW5jbHVkZWQgaW4gdGhlIGBhc3NldHNgIGF0dHJpYnV0ZSBvZiB0aGUgYG5nX21vZHVsZWAgcnVsZS5cXG4nKTtcbiAgfTtcblxuICBjb25zdCBlbWl0Q2FsbGJhY2s6IFRzRW1pdENhbGxiYWNrID0gKHtcbiAgICBwcm9ncmFtLFxuICAgIHRhcmdldFNvdXJjZUZpbGUsXG4gICAgd3JpdGVGaWxlLFxuICAgIGNhbmNlbGxhdGlvblRva2VuLFxuICAgIGVtaXRPbmx5RHRzRmlsZXMsXG4gICAgY3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIH0pID0+XG4gICAgICB0c2lja2xlLmVtaXRXaXRoVHNpY2tsZShcbiAgICAgICAgICBwcm9ncmFtLCBiYXplbEhvc3QsIGJhemVsSG9zdCwgY29tcGlsZXJPcHRzLCB0YXJnZXRTb3VyY2VGaWxlLCB3cml0ZUZpbGUsXG4gICAgICAgICAgY2FuY2VsbGF0aW9uVG9rZW4sIGVtaXRPbmx5RHRzRmlsZXMsIHtcbiAgICAgICAgICAgIGJlZm9yZVRzOiBjdXN0b21UcmFuc2Zvcm1lcnMuYmVmb3JlLFxuICAgICAgICAgICAgYWZ0ZXJUczogY3VzdG9tVHJhbnNmb3JtZXJzLmFmdGVyLFxuICAgICAgICAgICAgYWZ0ZXJEZWNsYXJhdGlvbnM6IGN1c3RvbVRyYW5zZm9ybWVycy5hZnRlckRlY2xhcmF0aW9ucyxcbiAgICAgICAgICB9KTtcblxuICBpZiAoIWdhdGhlckRpYWdub3N0aWNzKSB7XG4gICAgZ2F0aGVyRGlhZ25vc3RpY3MgPSAocHJvZ3JhbSkgPT5cbiAgICAgICAgZ2F0aGVyRGlhZ25vc3RpY3NGb3JJbnB1dHNPbmx5KGNvbXBpbGVyT3B0cywgYmF6ZWxPcHRzLCBwcm9ncmFtLCBuZyk7XG4gIH1cbiAgY29uc3Qge2RpYWdub3N0aWNzLCBlbWl0UmVzdWx0LCBwcm9ncmFtfSA9IG5nLnBlcmZvcm1Db21waWxhdGlvbih7XG4gICAgcm9vdE5hbWVzOiBmaWxlcyxcbiAgICBvcHRpb25zOiBjb21waWxlck9wdHMsXG4gICAgaG9zdDogbmdIb3N0LFxuICAgIGVtaXRDYWxsYmFjayxcbiAgICBtZXJnZUVtaXRSZXN1bHRzQ2FsbGJhY2s6IHRzaWNrbGUubWVyZ2VFbWl0UmVzdWx0cyxcbiAgICBnYXRoZXJEaWFnbm9zdGljc1xuICB9KTtcbiAgY29uc3QgdHNpY2tsZUVtaXRSZXN1bHQgPSBlbWl0UmVzdWx0IGFzIHRzaWNrbGUuRW1pdFJlc3VsdDtcbiAgbGV0IGV4dGVybnMgPSAnLyoqIEBleHRlcm5zICovXFxuJztcbiAgY29uc3QgaGFzRXJyb3IgPSBkaWFnbm9zdGljcy5zb21lKChkaWFnKSA9PiBkaWFnLmNhdGVnb3J5ID09PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpO1xuICBpZiAoIWhhc0Vycm9yKSB7XG4gICAgaWYgKGJhemVsT3B0cy50c2lja2xlR2VuZXJhdGVFeHRlcm5zKSB7XG4gICAgICBleHRlcm5zICs9IHRzaWNrbGUuZ2V0R2VuZXJhdGVkRXh0ZXJucyh0c2lja2xlRW1pdFJlc3VsdC5leHRlcm5zLCBjb21waWxlck9wdHMucm9vdERpciEpO1xuICAgIH1cbiAgICBpZiAoYmF6ZWxPcHRzLm1hbmlmZXN0KSB7XG4gICAgICBjb25zdCBtYW5pZmVzdCA9IGNvbnN0cnVjdE1hbmlmZXN0KHRzaWNrbGVFbWl0UmVzdWx0Lm1vZHVsZXNNYW5pZmVzdCwgYmF6ZWxIb3N0KTtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmMoYmF6ZWxPcHRzLm1hbmlmZXN0LCBtYW5pZmVzdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgY29tcGlsYXRpb24gZmFpbHMgdW5leHBlY3RlZGx5LCBwZXJmb3JtQ29tcGlsYXRpb24gcmV0dXJucyBubyBwcm9ncmFtLlxuICAvLyBNYWtlIHN1cmUgbm90IHRvIGNyYXNoIGJ1dCByZXBvcnQgdGhlIGRpYWdub3N0aWNzLlxuICBpZiAoIXByb2dyYW0pIHJldHVybiB7cHJvZ3JhbSwgZGlhZ25vc3RpY3N9O1xuXG4gIGlmIChiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoKSB7XG4gICAgLy8gTm90ZTogd2hlbiB0c2lja2xlRXh0ZXJuc1BhdGggaXMgcHJvdmlkZWQsIHdlIGFsd2F5cyB3cml0ZSBhIGZpbGUgYXMgYVxuICAgIC8vIG1hcmtlciB0aGF0IGNvbXBpbGF0aW9uIHN1Y2NlZWRlZCwgZXZlbiBpZiBpdCdzIGVtcHR5IChqdXN0IGNvbnRhaW5pbmcgYW5cbiAgICAvLyBAZXh0ZXJucykuXG4gICAgZnMud3JpdGVGaWxlU3luYyhiYXplbE9wdHMudHNpY2tsZUV4dGVybnNQYXRoLCBleHRlcm5zKTtcbiAgfVxuXG4gIC8vIFRoZXJlIG1pZ2h0IGJlIHNvbWUgZXhwZWN0ZWQgb3V0cHV0IGZpbGVzIHRoYXQgYXJlIG5vdCB3cml0dGVuIGJ5IHRoZVxuICAvLyBjb21waWxlci4gSW4gdGhpcyBjYXNlLCBqdXN0IHdyaXRlIGFuIGVtcHR5IGZpbGUuXG4gIGZvciAoY29uc3QgZmlsZU5hbWUgb2YgZXhwZWN0ZWRPdXRzU2V0KSB7XG4gICAgb3JpZ2luYWxXcml0ZUZpbGUoZmlsZU5hbWUsICcnLCBmYWxzZSk7XG4gIH1cblxuICBpZiAoIWNvbXBpbGVyT3B0cy5ub0VtaXQpIHtcbiAgICBtYXliZVdyaXRlVW51c2VkSW5wdXRzTGlzdChwcm9ncmFtLmdldFRzUHJvZ3JhbSgpLCBjb21waWxlck9wdHMsIGJhemVsT3B0cyk7XG4gIH1cblxuICByZXR1cm4ge3Byb2dyYW0sIGRpYWdub3N0aWNzfTtcbn1cblxuLyoqXG4gKiBXcml0ZXMgYSBjb2xsZWN0aW9uIG9mIHVudXNlZCBpbnB1dCBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgd2hpY2ggY2FuIGJlXG4gKiBjb25zdW1lZCBieSBiYXplbCB0byBhdm9pZCB0cmlnZ2VyaW5nIHJlYnVpbGRzIGlmIG9ubHkgdW51c2VkIGlucHV0cyBhcmVcbiAqIGNoYW5nZWQuXG4gKlxuICogU2VlIGh0dHBzOi8vYmF6ZWwuYnVpbGQvY29udHJpYnV0ZS9jb2RlYmFzZSNpbnB1dC1kaXNjb3ZlcnlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1heWJlV3JpdGVVbnVzZWRJbnB1dHNMaXN0KFxuICAgIHByb2dyYW06IHRzLlByb2dyYW0sIG9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMpIHtcbiAgaWYgKCFiYXplbE9wdHM/LnVudXNlZElucHV0c0xpc3RQYXRoKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gdHMuUHJvZ3JhbSdzIGdldFNvdXJjZUZpbGVzKCkgZ2V0cyBwb3B1bGF0ZWQgYnkgdGhlIHNvdXJjZXMgYWN0dWFsbHlcbiAgLy8gbG9hZGVkIHdoaWxlIHRoZSBwcm9ncmFtIGlzIGJlaW5nIGJ1aWx0LlxuICBjb25zdCB1c2VkRmlsZXMgPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBwcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAvLyBPbmx5IGNvbmNlcm4gb3Vyc2VsdmVzIHdpdGggdHlwZXNjcmlwdCBmaWxlcy5cbiAgICB1c2VkRmlsZXMuYWRkKHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuICB9XG5cbiAgLy8gYWxsb3dlZElucHV0cyBhcmUgYWJzb2x1dGUgcGF0aHMgdG8gZmlsZXMgd2hpY2ggbWF5IGFsc28gZW5kIHdpdGggLyogd2hpY2hcbiAgLy8gaW1wbGllcyBhbnkgZmlsZXMgaW4gdGhhdCBkaXJlY3RvcnkgY2FuIGJlIHVzZWQuXG4gIGNvbnN0IHVudXNlZElucHV0czogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBmIG9mIGJhemVsT3B0cy5hbGxvd2VkSW5wdXRzKSB7XG4gICAgLy8gQSB0cy94IGZpbGUgaXMgdW51c2VkIGlmIGl0IHdhcyBub3QgZm91bmQgZGlyZWN0bHkgaW4gdGhlIHVzZWQgc291cmNlcy5cbiAgICBpZiAoKGYuZW5kc1dpdGgoJy50cycpIHx8IGYuZW5kc1dpdGgoJy50c3gnKSkgJiYgIXVzZWRGaWxlcy5oYXMoZikpIHtcbiAgICAgIHVudXNlZElucHV0cy5wdXNoKGYpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogSXRlcmF0ZSBvdmVyIGNvbnRlbnRzIG9mIGFsbG93ZWQgZGlyZWN0b3JpZXMgY2hlY2tpbmcgZm9yIHVzZWQgZmlsZXMuXG4gIH1cblxuICAvLyBCYXplbCBleHBlY3RzIHRoZSB1bnVzZWQgaW5wdXQgbGlzdCB0byBjb250YWluIHBhdGhzIHJlbGF0aXZlIHRvIHRoZVxuICAvLyBleGVjcm9vdCBkaXJlY3RvcnkuXG4gIC8vIFNlZSBodHRwczovL2RvY3MuYmF6ZWwuYnVpbGQvdmVyc2lvbnMvbWFpbi9vdXRwdXRfZGlyZWN0b3JpZXMuaHRtbFxuICBmcy53cml0ZUZpbGVTeW5jKFxuICAgICAgYmF6ZWxPcHRzLnVudXNlZElucHV0c0xpc3RQYXRoLFxuICAgICAgdW51c2VkSW5wdXRzLm1hcChmID0+IHBhdGgucmVsYXRpdmUob3B0aW9ucy5yb290RGlyISwgZikpLmpvaW4oJ1xcbicpKTtcbn1cblxuZnVuY3Rpb24gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHM6IEJhemVsT3B0aW9ucywgc2Y6IHRzLlNvdXJjZUZpbGUpOiBib29sZWFuIHtcbiAgcmV0dXJuICFOR0NfR0VOX0ZJTEVTLnRlc3Qoc2YuZmlsZU5hbWUpICYmXG4gICAgICAoYmF6ZWxPcHRzLmNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluZGV4T2Yoc2YuZmlsZU5hbWUpICE9PSAtMSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0ZvcndhcmRTbGFzaFBhdGgoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG59XG5cbmZ1bmN0aW9uIGdhdGhlckRpYWdub3N0aWNzRm9ySW5wdXRzT25seShcbiAgICBvcHRpb25zOiBDb21waWxlck9wdGlvbnMsIGJhemVsT3B0czogQmF6ZWxPcHRpb25zLCBuZ1Byb2dyYW06IFByb2dyYW0sXG4gICAgbmc6IENvbXBpbGVyQ2xpTW9kdWxlKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgY29uc3QgdHNQcm9ncmFtID0gbmdQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gIC8vIEZvciB0aGUgSXZ5IGNvbXBpbGVyLCB0cmFjayB0aGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgZmV0Y2hpbmcgVHlwZVNjcmlwdCBkaWFnbm9zdGljcy5cbiAgbGV0IHByZXZpb3VzUGhhc2UgPSBuZy5QZXJmUGhhc2UuVW5hY2NvdW50ZWQ7XG4gIGlmIChuZ1Byb2dyYW0gaW5zdGFuY2VvZiBuZy5OZ3RzY1Byb2dyYW0pIHtcbiAgICBwcmV2aW91c1BoYXNlID0gbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShuZy5QZXJmUGhhc2UuVHlwZVNjcmlwdERpYWdub3N0aWNzKTtcbiAgfVxuICBjb25zdCBkaWFnbm9zdGljczogdHMuRGlhZ25vc3RpY1tdID0gW107XG4gIC8vIFRoZXNlIGNoZWNrcyBtaXJyb3IgdHMuZ2V0UHJlRW1pdERpYWdub3N0aWNzLCB3aXRoIHRoZSBpbXBvcnRhbnRcbiAgLy8gZXhjZXB0aW9uIG9mIGF2b2lkaW5nIGIvMzA3MDgyNDAsIHdoaWNoIGlzIHRoYXQgaWYgeW91IGNhbGxcbiAgLy8gcHJvZ3JhbS5nZXREZWNsYXJhdGlvbkRpYWdub3N0aWNzKCkgaXQgc29tZWhvdyBjb3JydXB0cyB0aGUgZW1pdC5cbiAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCkpO1xuICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpKTtcbiAgY29uc3QgcHJvZ3JhbUZpbGVzID0gdHNQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkuZmlsdGVyKGYgPT4gaXNDb21waWxhdGlvblRhcmdldChiYXplbE9wdHMsIGYpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9ncmFtRmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBzZiA9IHByb2dyYW1GaWxlc1tpXTtcbiAgICAvLyBOb3RlOiBXZSBvbmx5IGdldCB0aGUgZGlhZ25vc3RpY3MgZm9yIGluZGl2aWR1YWwgZmlsZXNcbiAgICAvLyB0byBlLmcuIG5vdCBjaGVjayBsaWJyYXJpZXMuXG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50c1Byb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc2YpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnRzUHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNmKSk7XG4gIH1cblxuICBpZiAobmdQcm9ncmFtIGluc3RhbmNlb2YgbmcuTmd0c2NQcm9ncmFtKSB7XG4gICAgbmdQcm9ncmFtLmNvbXBpbGVyLnBlcmZSZWNvcmRlci5waGFzZShwcmV2aW91c1BoYXNlKTtcbiAgfVxuXG4gIGlmICghZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgLy8gb25seSBnYXRoZXIgdGhlIGFuZ3VsYXIgZGlhZ25vc3RpY3MgaWYgd2UgaGF2ZSBubyBkaWFnbm9zdGljc1xuICAgIC8vIGluIGFueSBvdGhlciBmaWxlcy5cbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1N0cnVjdHVyYWxEaWFnbm9zdGljcygpKTtcbiAgICBkaWFnbm9zdGljcy5wdXNoKC4uLm5nUHJvZ3JhbS5nZXROZ1NlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cbiAgcmV0dXJuIGRpYWdub3N0aWNzO1xufVxuXG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgbWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpLnRoZW4oZXhpdENvZGUgPT4gcHJvY2Vzcy5leGl0Q29kZSA9IGV4aXRDb2RlKS5jYXRjaChlID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICB9KTtcbn1cblxuLyoqXG4gKiBBZGRzIHN1cHBvcnQgZm9yIHRoZSBvcHRpb25hbCBgZmlsZU5hbWVUb01vZHVsZU5hbWVgIG9wZXJhdGlvbiB0byBhIGdpdmVuIGBuZy5Db21waWxlckhvc3RgLlxuICpcbiAqIFRoaXMgaXMgdXNlZCB3aXRoaW4gYG5nYy13cmFwcGVkYCBhbmQgdGhlIEJhemVsIGNvbXBpbGF0aW9uIGZsb3csIGJ1dCBpcyBleHBvcnRlZCBoZXJlIHRvIGFsbG93XG4gKiBmb3Igb3RoZXIgY29uc3VtZXJzIG9mIHRoZSBjb21waWxlciB0byBhY2Nlc3MgdGhpcyBzYW1lIGxvZ2ljLiBGb3IgZXhhbXBsZSwgdGhlIHhpMThuIG9wZXJhdGlvblxuICogaW4gZzMgY29uZmlndXJlcyBpdHMgb3duIGBuZy5Db21waWxlckhvc3RgIHdoaWNoIGFsc28gcmVxdWlyZXMgYGZpbGVOYW1lVG9Nb2R1bGVOYW1lYCB0byB3b3JrXG4gKiBjb3JyZWN0bHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXRjaE5nSG9zdFdpdGhGaWxlTmFtZVRvTW9kdWxlTmFtZShcbiAgICBuZ0hvc3Q6IE5nQ29tcGlsZXJIb3N0LCBjb21waWxlck9wdHM6IENvbXBpbGVyT3B0aW9ucywgYmF6ZWxPcHRzOiBCYXplbE9wdGlvbnMsXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgbmdIb3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lID0gKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBgJHtpbXBvcnRlZEZpbGVQYXRofToke2NvbnRhaW5pbmdGaWxlUGF0aH1gO1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhjYWNoZUtleSkpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmdldChjYWNoZUtleSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCwgY29udGFpbmluZ0ZpbGVQYXRoKTtcbiAgICBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLnNldChjYWNoZUtleSwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlbGF0aXZlVGFyZ2V0UGF0aCA9XG4gICAgICAgIHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCBjb21waWxlck9wdHMucm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgY29uc3QgbWFuaWZlc3RUYXJnZXRQYXRoID0gYCR7YmF6ZWxPcHRzLndvcmtzcGFjZU5hbWV9LyR7cmVsYXRpdmVUYXJnZXRQYXRofWA7XG4gICAgaWYgKHVzZU1hbmlmZXN0UGF0aHNBc01vZHVsZU5hbWUgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBtYW5pZmVzdFRhcmdldFBhdGg7XG4gICAgfVxuXG4gICAgLy8gVW5sZXNzIG1hbmlmZXN0IHBhdGhzIGFyZSBleHBsaWNpdGx5IGVuZm9yY2VkLCB3ZSBpbml0aWFsbHkgY2hlY2sgaWYgYSBtb2R1bGUgbmFtZSBpc1xuICAgIC8vIHNldCBmb3IgdGhlIGdpdmVuIHNvdXJjZSBmaWxlLiBUaGUgY29tcGlsZXIgaG9zdCBmcm9tIGBAYmF6ZWwvY29uY2F0anNgIHNldHMgc291cmNlXG4gICAgLy8gZmlsZSBtb2R1bGUgbmFtZXMgaWYgdGhlIGNvbXBpbGF0aW9uIHRhcmdldHMgZWl0aGVyIFVNRCBvciBBTUQuIFRvIGVuc3VyZSB0aGF0IHRoZSBBTURcbiAgICAvLyBtb2R1bGUgbmFtZXMgbWF0Y2gsIHdlIGZpcnN0IGNvbnNpZGVyIHRob3NlLlxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gbmdIb3N0LmdldFNvdXJjZUZpbGUoaW1wb3J0ZWRGaWxlUGF0aCwgdHMuU2NyaXB0VGFyZ2V0LkxhdGVzdCk7XG4gICAgICBpZiAoc291cmNlRmlsZSAmJiBzb3VyY2VGaWxlLm1vZHVsZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUZpbGUubW9kdWxlTmFtZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgcGFyc2UgZXJyb3IuIElnbm9yZSB0aGlzIGNhc2UgYW5kIGNvbnRpbnVlIG9udG8gdGhlXG4gICAgICAvLyBvdGhlciBtZXRob2RzIG9mIHJlc29sdmluZyB0aGUgbW9kdWxlIGJlbG93LlxuICAgIH1cblxuICAgIC8vIEl0IGNhbiBoYXBwZW4gdGhhdCB0aGUgVmlld0VuZ2luZSBjb21waWxlciBuZWVkcyB0byB3cml0ZSBhbiBpbXBvcnQgaW4gYSBmYWN0b3J5IGZpbGUsXG4gICAgLy8gYW5kIGlzIHVzaW5nIGFuIG5nc3VtbWFyeSBmaWxlIHRvIGdldCB0aGUgc3ltYm9scy5cbiAgICAvLyBUaGUgbmdzdW1tYXJ5IGNvbWVzIGZyb20gYW4gdXBzdHJlYW0gbmdfbW9kdWxlIHJ1bGUuXG4gICAgLy8gVGhlIHVwc3RyZWFtIHJ1bGUgYmFzZWQgaXRzIGltcG9ydHMgb24gbmdzdW1tYXJ5IGZpbGUgd2hpY2ggd2FzIGdlbmVyYXRlZCBmcm9tIGFcbiAgICAvLyBtZXRhZGF0YS5qc29uIGZpbGUgdGhhdCB3YXMgcHVibGlzaGVkIHRvIG5wbSBpbiBhbiBBbmd1bGFyIGxpYnJhcnkuXG4gICAgLy8gSG93ZXZlciwgdGhlIG5nc3VtbWFyeSBkb2Vzbid0IHByb3BhZ2F0ZSB0aGUgJ2ltcG9ydEFzJyBmcm9tIHRoZSBvcmlnaW5hbCBtZXRhZGF0YS5qc29uXG4gICAgLy8gc28gd2Ugd291bGQgbm9ybWFsbHkgbm90IGJlIGFibGUgdG8gc3VwcGx5IHRoZSBjb3JyZWN0IG1vZHVsZSBuYW1lIGZvciBpdC5cbiAgICAvLyBGb3IgZXhhbXBsZSwgaWYgdGhlIHJvb3REaXItcmVsYXRpdmUgZmlsZVBhdGggaXNcbiAgICAvLyAgbm9kZV9tb2R1bGVzL0Bhbmd1bGFyL21hdGVyaWFsL3Rvb2xiYXIvdHlwaW5ncy9pbmRleFxuICAgIC8vIHdlIHdvdWxkIHN1cHBseSBhIG1vZHVsZSBuYW1lXG4gICAgLy8gIEBhbmd1bGFyL21hdGVyaWFsL3Rvb2xiYXIvdHlwaW5ncy9pbmRleFxuICAgIC8vIGJ1dCB0aGVyZSBpcyBubyBKYXZhU2NyaXB0IGZpbGUgdG8gbG9hZCBhdCB0aGlzIHBhdGguXG4gICAgLy8gVGhpcyBpcyBhIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIvaXNzdWVzLzI5NDU0XG4gICAgaWYgKGltcG9ydGVkRmlsZVBhdGguaW5kZXhPZignbm9kZV9tb2R1bGVzJykgPj0gMCkge1xuICAgICAgY29uc3QgbWF5YmVNZXRhZGF0YUZpbGUgPSBpbXBvcnRlZEZpbGVQYXRoLnJlcGxhY2UoRVhULCAnJykgKyAnLm1ldGFkYXRhLmpzb24nO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobWF5YmVNZXRhZGF0YUZpbGUpKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSAoSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMobWF5YmVNZXRhZGF0YUZpbGUsIHtlbmNvZGluZzogJ3V0Zi04J30pKSBhcyB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltcG9ydEFzOiBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmltcG9ydEFzO1xuICAgICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICAgIHJldHVybiBtb2R1bGVOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLlVNRCB8fCBjb21waWxlck9wdHMubW9kdWxlID09PSB0cy5Nb2R1bGVLaW5kLkFNRCkgJiZcbiAgICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWUpIHtcbiAgICAgIHJldHVybiBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7ZmlsZU5hbWU6IGltcG9ydGVkRmlsZVBhdGh9IGFzIHRzLlNvdXJjZUZpbGUpO1xuICAgIH1cblxuICAgIC8vIElmIG5vIEFNRCBtb2R1bGUgbmFtZSBoYXMgYmVlbiBzZXQgZm9yIHRoZSBzb3VyY2UgZmlsZSBieSB0aGUgYEBiYXplbC9jb25jYXRqc2AgY29tcGlsZXJcbiAgICAvLyBob3N0LCBhbmQgdGhlIHRhcmdldCBmaWxlIGlzIG5vdCBwYXJ0IG9mIGEgZmxhdCBtb2R1bGUgbm9kZSBtb2R1bGUgcGFja2FnZSwgd2UgdXNlIHRoZVxuICAgIC8vIGZvbGxvd2luZyBydWxlcyAoaW4gb3JkZXIpOlxuICAgIC8vICAgIDEuIElmIHRhcmdldCBmaWxlIGlzIHBhcnQgb2YgYG5vZGVfbW9kdWxlcy9gLCB3ZSB1c2UgdGhlIHBhY2thZ2UgbW9kdWxlIG5hbWUuXG4gICAgLy8gICAgMi4gSWYgbm8gY29udGFpbmluZyBmaWxlIGlzIHNwZWNpZmllZCwgb3IgdGhlIHRhcmdldCBmaWxlIGlzIHBhcnQgb2YgYSBkaWZmZXJlbnRcbiAgICAvLyAgICAgICBjb21waWxhdGlvbiB1bml0LCB3ZSB1c2UgYSBCYXplbCBtYW5pZmVzdCBwYXRoLiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IHBvc3NpYmxlXG4gICAgLy8gICAgICAgc2luY2Ugd2UgZG9uJ3QgaGF2ZSBhIGNvbnRhaW5pbmcgZmlsZSwgYW5kIHRoZSB0YXJnZXQgZmlsZSBjb3VsZCBiZSBsb2NhdGVkIGluIHRoZVxuICAgIC8vICAgICAgIG91dHB1dCBkaXJlY3RvcnksIG9yIGluIGFuIGV4dGVybmFsIEJhemVsIHJlcG9zaXRvcnkuXG4gICAgLy8gICAgMy4gSWYgYm90aCBydWxlcyBhYm92ZSBkaWRuJ3QgbWF0Y2gsIHdlIGNvbXB1dGUgYSByZWxhdGl2ZSBwYXRoIGJldHdlZW4gdGhlIHNvdXJjZSBmaWxlc1xuICAgIC8vICAgICAgIHNpbmNlIHRoZXkgYXJlIHBhcnQgb2YgdGhlIHNhbWUgY29tcGlsYXRpb24gdW5pdC5cbiAgICAvLyBOb3RlIHRoYXQgd2UgZG9uJ3Qgd2FudCB0byBhbHdheXMgdXNlICgyKSBiZWNhdXNlIGl0IGNvdWxkIG1lYW4gdGhhdCBjb21waWxhdGlvbiBvdXRwdXRzXG4gICAgLy8gYXJlIGFsd2F5cyBsZWFraW5nIEJhemVsLXNwZWNpZmljIHBhdGhzLCBhbmQgdGhlIG91dHB1dCBpcyBub3Qgc2VsZi1jb250YWluZWQuIFRoaXMgY291bGRcbiAgICAvLyBicmVhayBgZXNtMjAxNWAgb3IgYGVzbTVgIG91dHB1dCBmb3IgQW5ndWxhciBwYWNrYWdlIHJlbGVhc2Ugb3V0cHV0XG4gICAgLy8gT21pdCB0aGUgYG5vZGVfbW9kdWxlc2AgcHJlZml4IGlmIHRoZSBtb2R1bGUgbmFtZSBvZiBhbiBOUE0gcGFja2FnZSBpcyByZXF1ZXN0ZWQuXG4gICAgaWYgKHJlbGF0aXZlVGFyZ2V0UGF0aC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZWxhdGl2ZVRhcmdldFBhdGguc2xpY2UoTk9ERV9NT0RVTEVTLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgY29udGFpbmluZ0ZpbGVQYXRoID09IG51bGwgfHwgIWJhemVsT3B0cy5jb21waWxhdGlvblRhcmdldFNyYy5pbmNsdWRlcyhpbXBvcnRlZEZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG4gICAgY29uc3QgY29udGFpbmluZ0ZpbGVEaXIgPVxuICAgICAgICBwYXRoLmRpcm5hbWUocmVsYXRpdmVUb1Jvb3REaXJzKGNvbnRhaW5pbmdGaWxlUGF0aCwgY29tcGlsZXJPcHRzLnJvb3REaXJzKSk7XG4gICAgY29uc3QgcmVsYXRpdmVJbXBvcnRQYXRoID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShjb250YWluaW5nRmlsZURpciwgcmVsYXRpdmVUYXJnZXRQYXRoKTtcbiAgICByZXR1cm4gcmVsYXRpdmVJbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy4nKSA/IHJlbGF0aXZlSW1wb3J0UGF0aCA6IGAuLyR7cmVsYXRpdmVJbXBvcnRQYXRofWA7XG4gIH1cbn1cbiJdfQ==