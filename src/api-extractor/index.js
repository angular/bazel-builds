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
        define("npm_angular_bazel/src/api-extractor/index", ["require", "exports", "tslib", "@bazel/typescript", "@microsoft/api-extractor", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types="node"/>
    /// <reference lib="es2017"/>
    var typescript_1 = require("@bazel/typescript");
    var api_extractor_1 = require("@microsoft/api-extractor");
    var fs = require("fs");
    var path = require("path");
    var DEBUG = false;
    function runMain(tsConfig, entryPoint, dtsBundleOut, apiReviewFolder, acceptApiUpdates) {
        var e_1, _a;
        if (acceptApiUpdates === void 0) { acceptApiUpdates = false; }
        var _b = tslib_1.__read(typescript_1.parseTsconfig(tsConfig), 2), parsedConfig = _b[0], errors = _b[1];
        if (errors && errors.length) {
            console.error(typescript_1.format('', errors));
            return 1;
        }
        var pkgJson = path.resolve(path.dirname(entryPoint), 'package.json');
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
            for (var _c = tslib_1.__values(Object.entries(compilerOptions.paths)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = tslib_1.__read(_d.value, 2), key = _e[0], values = _e[1];
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
            mainEntryPointFilePath: path.resolve(entryPoint),
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
                enabled: !!dtsBundleOut,
                untrimmedFilePath: dtsBundleOut && path.resolve(dtsBundleOut),
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
            console.error("\napi-extractor: running with\n  cwd: " + process.cwd() + "\n  argv:\n    " + process.argv.join('\n    ') + "\n  ");
        }
        var _a = tslib_1.__read(process.argv.slice(2), 3), tsConfig = _a[0], entryPoint = _a[1], dtsBundleOut = _a[2];
        var entryPoints = entryPoint.split(',');
        var dtsBundleOuts = dtsBundleOut.split(',');
        if (entryPoints.length !== entryPoints.length) {
            throw new Error("Entry points count (" + entryPoints.length + ") does not match Bundle out count (" + dtsBundleOuts.length + ")");
        }
        for (var i = 0; i < entryPoints.length; i++) {
            process.exitCode = runMain(tsConfig, entryPoints[i], dtsBundleOuts[i]);
            if (process.exitCode !== 0) {
                break;
            }
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2QkFBNkI7SUFDN0IsNkJBQTZCO0lBRTdCLGdEQUF3RDtJQUN4RCwwREFBMEk7SUFDMUksdUJBQXlCO0lBQ3pCLDJCQUE2QjtJQUU3QixJQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFcEIsU0FBZ0IsT0FBTyxDQUNuQixRQUFnQixFQUFFLFVBQWtCLEVBQUUsWUFBcUIsRUFBRSxlQUF3QixFQUNyRixnQkFBd0I7O1FBQXhCLGlDQUFBLEVBQUEsd0JBQXdCO1FBQ3BCLElBQUEsNERBQWdELEVBQS9DLG9CQUFZLEVBQUUsY0FBaUMsQ0FBQztRQUN2RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUJBQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUVsQyxPQUFPLENBQUMsQ0FBQztTQUNWO1FBRUQsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxvQkFBb0I7Z0JBQzVCLFNBQVMsRUFBRSxPQUFPO2dCQUNsQixhQUFhLEVBQUUsb0VBQW9FO2FBQ3BGLENBQUMsQ0FBQyxDQUFDO1NBQ0w7UUFFRCxrRkFBa0Y7UUFDbEYsdURBQXVEO1FBQ3ZELGtHQUFrRztRQUNsRyxJ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QVcsQ0FBQyxNQUFNLEVBQUU7WUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBdUIsV0FBVyxDQUFDLE1BQU0sMkNBQ3JELGFBQWEsQ0FBQyxNQUFNLE1BQUcsQ0FBQyxDQUFDO1NBQzlCO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDM0MsT0FBTyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV2RSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxFQUFFO2dCQUMxQixNQUFNO2FBQ1A7U0FDRjtLQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIi8+XG4vLy8gPHJlZmVyZW5jZSBsaWI9XCJlczIwMTdcIi8+XG5cbmltcG9ydCB7Zm9ybWF0LCBwYXJzZVRzY29uZmlnfSBmcm9tICdAYmF6ZWwvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0V4dHJhY3RvciwgRXh0cmFjdG9yQ29uZmlnLCBJQ29uZmlnRmlsZSwgSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zLCBJRXh0cmFjdG9ySW52b2tlT3B0aW9uc30gZnJvbSAnQG1pY3Jvc29mdC9hcGktZXh0cmFjdG9yJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5NYWluKFxuICAgIHRzQ29uZmlnOiBzdHJpbmcsIGVudHJ5UG9pbnQ6IHN0cmluZywgZHRzQnVuZGxlT3V0Pzogc3RyaW5nLCBhcGlSZXZpZXdGb2xkZXI/OiBzdHJpbmcsXG4gICAgYWNjZXB0QXBpVXBkYXRlcyA9IGZhbHNlKTogMXwwIHtcbiAgY29uc3QgW3BhcnNlZENvbmZpZywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcodHNDb25maWcpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKGZvcm1hdCgnJywgZXJyb3JzKSk7XG5cbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIGNvbnN0IHBrZ0pzb24gPSBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKGVudHJ5UG9pbnQpLCAncGFja2FnZS5qc29uJyk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwa2dKc29uKSkge1xuICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvbiwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgJ25hbWUnOiAnR0VORVJBVEVELUJZLUJBWkVMJyxcbiAgICAgICd2ZXJzaW9uJzogJzAuMC4wJyxcbiAgICAgICdkZXNjcmlwdGlvbic6ICdUaGlzIGlzIGEgZHVtbXkgcGFja2FnZS5qc29uIGFzIEFQSSBFeHRyYWN0b3IgYWx3YXlzIHJlcXVpcmVzIG9uZS4nLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8vIEFQSSBleHRyYWN0b3IgZG9lc24ndCBhbHdheXMgc3VwcG9ydCB0aGUgdmVyc2lvbiBvZiBUeXBlU2NyaXB0IHVzZWQgaW4gdGhlIHJlcG9cbiAgLy8gZXhhbXBsZTogYXQgdGhlIG1vbWVudCBpdCBpcyBub3QgY29tcGF0YWJsZSB3aXRoIDMuMlxuICAvLyB0byB1c2UgdGhlIGludGVybmFsIFR5cGVTY3JpcHQgd2Ugc2hhbGwgbm90IGNyZWF0ZSBhIHByb2dyYW0gYnV0IHJhdGhlciBwYXNzIGEgcGFyc2VkIHRzQ29uZmlnLlxuICBjb25zdCBwYXJzZWRUc0NvbmZpZyA9IHBhcnNlZENvbmZpZyEuY29uZmlnIGFzIGFueTtcbiAgY29uc3QgY29tcGlsZXJPcHRpb25zID0gcGFyc2VkVHNDb25maWcuY29tcGlsZXJPcHRpb25zO1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXM8c3RyaW5nW10+KGNvbXBpbGVyT3B0aW9ucy5wYXRocykpIHtcbiAgICBpZiAoa2V5ID09PSAnKicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHdlIHNoYWxsIG5vdCBwYXNzIHRzIGZpbGVzIGFzIHRoaXMgd2lsbCBuZWVkIHRvIGJlIHBhcnNlZCwgYW5kIGZvciBleGFtcGxlIHJ4anMsXG4gICAgLy8gY2Fubm90IGJlIGNvbXBpbGVkIHdpdGggb3VyIHRzY29uZmlnLCBhcyBvdXJzIGlzIG1vcmUgc3RyaWN0XG4gICAgLy8gaGVuY2UgYW1lbmQgdGhlIHBhdGhzIHRvIHBvaW50IGFsd2F5cyB0byB0aGUgJy5kLnRzJyBmaWxlcy5cbiAgICBjb21waWxlck9wdGlvbnMucGF0aHNba2V5XSA9IHZhbHVlcy5tYXAocGF0aCA9PiB7XG4gICAgICBjb25zdCBwYXRoU3VmZml4ID0gLyhcXCp8aW5kZXgpJC8udGVzdChwYXRoKSA/ICcuZC50cycgOiAnL2luZGV4LmQudHMnO1xuXG4gICAgICByZXR1cm4gcGF0aCArIHBhdGhTdWZmaXg7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBleHRyYWN0b3JPcHRpb25zOiBJRXh0cmFjdG9ySW52b2tlT3B0aW9ucyA9IHtcbiAgICBsb2NhbEJ1aWxkOiBhY2NlcHRBcGlVcGRhdGVzLFxuICB9O1xuXG4gIGNvbnN0IGNvbmZpZ09iamVjdDogSUNvbmZpZ0ZpbGUgPSB7XG4gICAgY29tcGlsZXI6IHtcbiAgICAgIG92ZXJyaWRlVHNjb25maWc6IHBhcnNlZFRzQ29uZmlnLFxuICAgIH0sXG4gICAgcHJvamVjdEZvbGRlcjogcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZSh0c0NvbmZpZykpLFxuICAgIG1haW5FbnRyeVBvaW50RmlsZVBhdGg6IHBhdGgucmVzb2x2ZShlbnRyeVBvaW50KSxcbiAgICBhcGlSZXBvcnQ6IHtcbiAgICAgIGVuYWJsZWQ6ICEhYXBpUmV2aWV3Rm9sZGVyLFxuICAgICAgLy8gVE9ETyhhbGFuLWFnaXVzNCk6IHJlbW92ZSB0aGlzIGZvbGRlciBuYW1lIHdoZW4gdGhlIGJlbG93IGlzc3VlIGlzIHNvbHZlZCB1cHN0cmVhbVxuICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3dlYi1idWlsZC10b29scy9pc3N1ZXMvMTQ3MFxuICAgICAgcmVwb3J0RmlsZU5hbWU6IGFwaVJldmlld0ZvbGRlciAmJiBwYXRoLnJlc29sdmUoYXBpUmV2aWV3Rm9sZGVyKSB8fCAnaW52YWxpZCcsXG4gICAgfSxcbiAgICBkb2NNb2RlbDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgfSxcbiAgICBkdHNSb2xsdXA6IHtcbiAgICAgIGVuYWJsZWQ6ICEhZHRzQnVuZGxlT3V0LFxuICAgICAgdW50cmltbWVkRmlsZVBhdGg6IGR0c0J1bmRsZU91dCAmJiBwYXRoLnJlc29sdmUoZHRzQnVuZGxlT3V0KSxcbiAgICB9LFxuICAgIHRzZG9jTWV0YWRhdGE6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH1cbiAgfTtcblxuICBjb25zdCBvcHRpb25zOiBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMgPSB7XG4gICAgY29uZmlnT2JqZWN0LFxuICAgIHBhY2thZ2VKc29uOiB1bmRlZmluZWQsXG4gICAgcGFja2FnZUpzb25GdWxsUGF0aDogcGtnSnNvbixcbiAgICBjb25maWdPYmplY3RGdWxsUGF0aDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IGV4dHJhY3RvckNvbmZpZyA9IEV4dHJhY3RvckNvbmZpZy5wcmVwYXJlKG9wdGlvbnMpO1xuICBjb25zdCB7c3VjY2VlZGVkfSA9IEV4dHJhY3Rvci5pbnZva2UoZXh0cmFjdG9yQ29uZmlnLCBleHRyYWN0b3JPcHRpb25zKTtcblxuICAvLyBBUEkgZXh0cmFjdG9yIGVycm9ycyBhcmUgZW1pdHRlZCBieSBpdCdzIGxvZ2dlci5cbiAgcmV0dXJuIHN1Y2NlZWRlZCA/IDAgOiAxO1xufVxuXG4vLyBFbnRyeSBwb2ludFxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGlmIChERUJVRykge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxuYXBpLWV4dHJhY3RvcjogcnVubmluZyB3aXRoXG4gIGN3ZDogJHtwcm9jZXNzLmN3ZCgpfVxuICBhcmd2OlxuICAgICR7cHJvY2Vzcy5hcmd2LmpvaW4oJ1xcbiAgICAnKX1cbiAgYCk7XG4gIH1cblxuICBjb25zdCBbdHNDb25maWcsIGVudHJ5UG9pbnQsIGR0c0J1bmRsZU91dF0gPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gZW50cnlQb2ludC5zcGxpdCgnLCcpO1xuICBjb25zdCBkdHNCdW5kbGVPdXRzID0gZHRzQnVuZGxlT3V0LnNwbGl0KCcsJyk7XG5cbiAgaWYgKGVudHJ5UG9pbnRzLmxlbmd0aCAhPT0gZW50cnlQb2ludHMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFbnRyeSBwb2ludHMgY291bnQgKCR7ZW50cnlQb2ludHMubGVuZ3RofSkgZG9lcyBub3QgbWF0Y2ggQnVuZGxlIG91dCBjb3VudCAoJHtcbiAgICAgICAgZHRzQnVuZGxlT3V0cy5sZW5ndGh9KWApO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRyeVBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSBydW5NYWluKHRzQ29uZmlnLCBlbnRyeVBvaW50c1tpXSwgZHRzQnVuZGxlT3V0c1tpXSk7XG5cbiAgICBpZiAocHJvY2Vzcy5leGl0Q29kZSAhPT0gMCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG4iXX0=