/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("angular/packages/bazel/src/api-extractor/index", ["require", "exports", "tslib", "@bazel/typescript", "@microsoft/api-extractor", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runMain = void 0;
    var tslib_1 = require("tslib");
    /// <reference types="node"/>
    /// <reference lib="es2017"/>
    var typescript_1 = require("@bazel/typescript");
    var api_extractor_1 = require("@microsoft/api-extractor");
    var fs = (0, tslib_1.__importStar)(require("fs"));
    var path = (0, tslib_1.__importStar)(require("path"));
    var DEBUG = false;
    function runMain(tsConfig, entryPointExecPath, dtsBundleOut, apiReviewFolder, acceptApiUpdates) {
        var e_1, _a;
        if (acceptApiUpdates === void 0) { acceptApiUpdates = false; }
        var _b = (0, tslib_1.__read)((0, typescript_1.parseTsconfig)(tsConfig), 2), parsedConfig = _b[0], errors = _b[1];
        if (errors && errors.length) {
            console.error((0, typescript_1.format)('', errors));
            return 1;
        }
        var pkgJson = path.resolve(path.dirname(entryPointExecPath), 'package.json');
        if (!fs.existsSync(pkgJson)) {
            fs.writeFileSync(pkgJson, JSON.stringify({
                'name': 'GENERATED-BY-BAZEL',
                'version': '0.0.0',
                'description': 'This is a dummy package.json as API Extractor always requires one.',
            }));
        }
        // API extractor doesn't always support the version of TypeScript used in the repo
        // example: at the moment it is not compatable with 3.2
        // to use the internal TypeScript we shall not create a program but rather pass a parsed tsConfig.
        var parsedTsConfig = parsedConfig.config;
        var compilerOptions = parsedTsConfig.compilerOptions;
        try {
            for (var _c = (0, tslib_1.__values)(Object.entries(compilerOptions.paths)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = (0, tslib_1.__read)(_d.value, 2), key = _e[0], values = _e[1];
                if (key === '*') {
                    continue;
                }
                // we shall not pass ts files as this will need to be parsed, and for example rxjs,
                // cannot be compiled with our tsconfig, as ours is more strict
                // hence amend the paths to point always to the '.d.ts' files.
                compilerOptions.paths[key] = values.map(function (path) {
                    var pathSuffix = /(\*|index)$/.test(path) ? '.d.ts' : '/index.d.ts';
                    return path + pathSuffix;
                });
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var extractorOptions = {
            localBuild: acceptApiUpdates,
        };
        var configObject = {
            compiler: {
                overrideTsconfig: parsedTsConfig,
            },
            projectFolder: path.resolve(path.dirname(tsConfig)),
            mainEntryPointFilePath: path.resolve(entryPointExecPath),
            apiReport: {
                enabled: !!apiReviewFolder,
                // TODO(alan-agius4): remove this folder name when the below issue is solved upstream
                // See: https://github.com/microsoft/web-build-tools/issues/1470
                reportFileName: apiReviewFolder && path.resolve(apiReviewFolder) || 'invalid',
            },
            docModel: {
                enabled: false,
            },
            dtsRollup: {
                enabled: true,
                untrimmedFilePath: path.resolve(dtsBundleOut),
            },
            tsdocMetadata: {
                enabled: false,
            }
        };
        var options = {
            configObject: configObject,
            packageJson: undefined,
            packageJsonFullPath: pkgJson,
            configObjectFullPath: undefined,
        };
        var extractorConfig = api_extractor_1.ExtractorConfig.prepare(options);
        var succeeded = api_extractor_1.Extractor.invoke(extractorConfig, extractorOptions).succeeded;
        // API extractor errors are emitted by it's logger.
        return succeeded ? 0 : 1;
    }
    exports.runMain = runMain;
    // Entry point
    if (require.main === module) {
        if (DEBUG) {
            console.error("\napi-extractor: running with\n  cwd: ".concat(process.cwd(), "\n  argv:\n    ").concat(process.argv.join('\n    '), "\n  "));
        }
        var _a = (0, tslib_1.__read)(process.argv.slice(2), 3), tsConfig = _a[0], entryPointExecPath = _a[1], outputExecPath = _a[2];
        process.exitCode = runMain(tsConfig, entryPointExecPath, outputExecPath);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLDZCQUE2QjtJQUU3QixnREFBd0Q7SUFDeEQsMERBQTBJO0lBQzFJLGtEQUF5QjtJQUN6QixzREFBNkI7SUFFN0IsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDO0lBRXBCLFNBQWdCLE9BQU8sQ0FDbkIsUUFBZ0IsRUFBRSxrQkFBMEIsRUFBRSxZQUFvQixFQUFFLGVBQXdCLEVBQzVGLGdCQUF3Qjs7UUFBeEIsaUNBQUEsRUFBQSx3QkFBd0I7UUFDcEIsSUFBQSxLQUFBLG9CQUF5QixJQUFBLDBCQUFhLEVBQUMsUUFBUSxDQUFDLElBQUEsRUFBL0MsWUFBWSxRQUFBLEVBQUUsTUFBTSxRQUEyQixDQUFDO1FBQ3ZELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDM0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFBLG1CQUFNLEVBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFFbEMsT0FBTyxDQUFDLENBQUM7U0FDVjtRQUVELElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQy9FLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxvQkFBb0I7Z0JBQzVCLFNBQVMsRUFBRSxPQUFPO2dCQUNsQixhQUFhLEVBQUUsb0VBQW9FO2FBQ3BGLENBQUMsQ0FBQyxD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LEVBQUUsY0FBYyxRQUF5QixDQUFDO1FBQzdFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxjQUFjLENBQUMsQ0FBQztLQUMxRSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIi8+XG4vLy8gPHJlZmVyZW5jZSBsaWI9XCJlczIwMTdcIi8+XG5cbmltcG9ydCB7Zm9ybWF0LCBwYXJzZVRzY29uZmlnfSBmcm9tICdAYmF6ZWwvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0V4dHJhY3RvciwgRXh0cmFjdG9yQ29uZmlnLCBJQ29uZmlnRmlsZSwgSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zLCBJRXh0cmFjdG9ySW52b2tlT3B0aW9uc30gZnJvbSAnQG1pY3Jvc29mdC9hcGktZXh0cmFjdG9yJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5NYWluKFxuICAgIHRzQ29uZmlnOiBzdHJpbmcsIGVudHJ5UG9pbnRFeGVjUGF0aDogc3RyaW5nLCBkdHNCdW5kbGVPdXQ6IHN0cmluZywgYXBpUmV2aWV3Rm9sZGVyPzogc3RyaW5nLFxuICAgIGFjY2VwdEFwaVVwZGF0ZXMgPSBmYWxzZSk6IDF8MCB7XG4gIGNvbnN0IFtwYXJzZWRDb25maWcsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHRzQ29uZmlnKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihmb3JtYXQoJycsIGVycm9ycykpO1xuXG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICBjb25zdCBwa2dKc29uID0gcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZShlbnRyeVBvaW50RXhlY1BhdGgpLCAncGFja2FnZS5qc29uJyk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwa2dKc29uKSkge1xuICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvbiwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgJ25hbWUnOiAnR0VORVJBVEVELUJZLUJBWkVMJyxcbiAgICAgICd2ZXJzaW9uJzogJzAuMC4wJyxcbiAgICAgICdkZXNjcmlwdGlvbic6ICdUaGlzIGlzIGEgZHVtbXkgcGFja2FnZS5qc29uIGFzIEFQSSBFeHRyYWN0b3IgYWx3YXlzIHJlcXVpcmVzIG9uZS4nLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8vIEFQSSBleHRyYWN0b3IgZG9lc24ndCBhbHdheXMgc3VwcG9ydCB0aGUgdmVyc2lvbiBvZiBUeXBlU2NyaXB0IHVzZWQgaW4gdGhlIHJlcG9cbiAgLy8gZXhhbXBsZTogYXQgdGhlIG1vbWVudCBpdCBpcyBub3QgY29tcGF0YWJsZSB3aXRoIDMuMlxuICAvLyB0byB1c2UgdGhlIGludGVybmFsIFR5cGVTY3JpcHQgd2Ugc2hhbGwgbm90IGNyZWF0ZSBhIHByb2dyYW0gYnV0IHJhdGhlciBwYXNzIGEgcGFyc2VkIHRzQ29uZmlnLlxuICBjb25zdCBwYXJzZWRUc0NvbmZpZyA9IHBhcnNlZENvbmZpZyEuY29uZmlnIGFzIGFueTtcbiAgY29uc3QgY29tcGlsZXJPcHRpb25zID0gcGFyc2VkVHNDb25maWcuY29tcGlsZXJPcHRpb25zO1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXM8c3RyaW5nW10+KGNvbXBpbGVyT3B0aW9ucy5wYXRocykpIHtcbiAgICBpZiAoa2V5ID09PSAnKicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHdlIHNoYWxsIG5vdCBwYXNzIHRzIGZpbGVzIGFzIHRoaXMgd2lsbCBuZWVkIHRvIGJlIHBhcnNlZCwgYW5kIGZvciBleGFtcGxlIHJ4anMsXG4gICAgLy8gY2Fubm90IGJlIGNvbXBpbGVkIHdpdGggb3VyIHRzY29uZmlnLCBhcyBvdXJzIGlzIG1vcmUgc3RyaWN0XG4gICAgLy8gaGVuY2UgYW1lbmQgdGhlIHBhdGhzIHRvIHBvaW50IGFsd2F5cyB0byB0aGUgJy5kLnRzJyBmaWxlcy5cbiAgICBjb21waWxlck9wdGlvbnMucGF0aHNba2V5XSA9IHZhbHVlcy5tYXAocGF0aCA9PiB7XG4gICAgICBjb25zdCBwYXRoU3VmZml4ID0gLyhcXCp8aW5kZXgpJC8udGVzdChwYXRoKSA/ICcuZC50cycgOiAnL2luZGV4LmQudHMnO1xuXG4gICAgICByZXR1cm4gcGF0aCArIHBhdGhTdWZmaXg7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBleHRyYWN0b3JPcHRpb25zOiBJRXh0cmFjdG9ySW52b2tlT3B0aW9ucyA9IHtcbiAgICBsb2NhbEJ1aWxkOiBhY2NlcHRBcGlVcGRhdGVzLFxuICB9O1xuXG4gIGNvbnN0IGNvbmZpZ09iamVjdDogSUNvbmZpZ0ZpbGUgPSB7XG4gICAgY29tcGlsZXI6IHtcbiAgICAgIG92ZXJyaWRlVHNjb25maWc6IHBhcnNlZFRzQ29uZmlnLFxuICAgIH0sXG4gICAgcHJvamVjdEZvbGRlcjogcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZSh0c0NvbmZpZykpLFxuICAgIG1haW5FbnRyeVBvaW50RmlsZVBhdGg6IHBhdGgucmVzb2x2ZShlbnRyeVBvaW50RXhlY1BhdGgpLFxuICAgIGFwaVJlcG9ydDoge1xuICAgICAgZW5hYmxlZDogISFhcGlSZXZpZXdGb2xkZXIsXG4gICAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogcmVtb3ZlIHRoaXMgZm9sZGVyIG5hbWUgd2hlbiB0aGUgYmVsb3cgaXNzdWUgaXMgc29sdmVkIHVwc3RyZWFtXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvd2ViLWJ1aWxkLXRvb2xzL2lzc3Vlcy8xNDcwXG4gICAgICByZXBvcnRGaWxlTmFtZTogYXBpUmV2aWV3Rm9sZGVyICYmIHBhdGgucmVzb2x2ZShhcGlSZXZpZXdGb2xkZXIpIHx8ICdpbnZhbGlkJyxcbiAgICB9LFxuICAgIGRvY01vZGVsOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIGR0c1JvbGx1cDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHVudHJpbW1lZEZpbGVQYXRoOiBwYXRoLnJlc29sdmUoZHRzQnVuZGxlT3V0KSxcbiAgICB9LFxuICAgIHRzZG9jTWV0YWRhdGE6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH1cbiAgfTtcblxuICBjb25zdCBvcHRpb25zOiBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMgPSB7XG4gICAgY29uZmlnT2JqZWN0LFxuICAgIHBhY2thZ2VKc29uOiB1bmRlZmluZWQsXG4gICAgcGFja2FnZUpzb25GdWxsUGF0aDogcGtnSnNvbixcbiAgICBjb25maWdPYmplY3RGdWxsUGF0aDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IGV4dHJhY3RvckNvbmZpZyA9IEV4dHJhY3RvckNvbmZpZy5wcmVwYXJlKG9wdGlvbnMpO1xuICBjb25zdCB7c3VjY2VlZGVkfSA9IEV4dHJhY3Rvci5pbnZva2UoZXh0cmFjdG9yQ29uZmlnLCBleHRyYWN0b3JPcHRpb25zKTtcblxuICAvLyBBUEkgZXh0cmFjdG9yIGVycm9ycyBhcmUgZW1pdHRlZCBieSBpdCdzIGxvZ2dlci5cbiAgcmV0dXJuIHN1Y2NlZWRlZCA/IDAgOiAxO1xufVxuXG4vLyBFbnRyeSBwb2ludFxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGlmIChERUJVRykge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxuYXBpLWV4dHJhY3RvcjogcnVubmluZyB3aXRoXG4gIGN3ZDogJHtwcm9jZXNzLmN3ZCgpfVxuICBhcmd2OlxuICAgICR7cHJvY2Vzcy5hcmd2LmpvaW4oJ1xcbiAgICAnKX1cbiAgYCk7XG4gIH1cblxuICBjb25zdCBbdHNDb25maWcsIGVudHJ5UG9pbnRFeGVjUGF0aCwgb3V0cHV0RXhlY1BhdGhdID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICBwcm9jZXNzLmV4aXRDb2RlID0gcnVuTWFpbih0c0NvbmZpZywgZW50cnlQb2ludEV4ZWNQYXRoLCBvdXRwdXRFeGVjUGF0aCk7XG59XG4iXX0=