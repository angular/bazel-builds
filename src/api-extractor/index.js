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
            customLogger: DEBUG ? undefined : {
                // don't log verbose messages when not in debug mode
                logVerbose: function (_message) { }
            }
        };
        var extractorConfig = {
            compiler: {
                configType: 'tsconfig',
                overrideTsconfig: parsedTsConfig,
                rootFolder: path.resolve(path.dirname(tsConfig))
            },
            project: {
                entryPointSourceFile: path.resolve(entryPoint),
            },
            apiReviewFile: {
                enabled: !!apiReviewFolder,
                apiReviewFolder: apiReviewFolder && path.resolve(apiReviewFolder),
            },
            apiJsonFile: {
                enabled: false,
            },
            policies: {
                namespaceSupport: 'permissive',
            },
            validationRules: {
                missingReleaseTags: "allow" /* allow */,
            },
            dtsRollup: {
                enabled: !!dtsBundleOut,
                publishFolder: dtsBundleOut && path.resolve(path.dirname(dtsBundleOut)),
                mainDtsRollupPath: dtsBundleOut && path.basename(dtsBundleOut),
            },
            tsdocMetadata: {
                enabled: false,
            }
        };
        var extractor = new api_extractor_1.Extractor(extractorConfig, extractorOptions);
        var isSuccessful = extractor.processProject();
        // API extractor errors are emitted by it's logger.
        return isSuccessful ? 0 : 1;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2QkFBNkI7SUFDN0IsNkJBQTZCO0lBRTdCLGdEQUF3RDtJQUN4RCwwREFBdUg7SUFDdkgsdUJBQXlCO0lBQ3pCLDJCQUE2QjtJQUU3QixJQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFcEIsU0FBZ0IsT0FBTyxDQUNuQixRQUFnQixFQUFFLFVBQWtCLEVBQUUsWUFBcUIsRUFBRSxlQUF3QixFQUNyRixnQkFBd0I7O1FBQXhCLGlDQUFBLEVBQUEsd0JBQXdCO1FBQ3BCLElBQUEsNERBQWdELEVBQS9DLG9CQUFZLEVBQUUsY0FBaUMsQ0FBQztRQUN2RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUJBQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUVsQyxPQUFPLENBQUMsQ0FBQztTQUNWO1FBRUQsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxvQkFBb0I7Z0JBQzVCLFNBQVMsRUFBRSxPQUFPO2dCQUNsQixhQUFhLEVBQUUsb0VBQW9FO2FBQ3BGLENBQUMsQ0FBQyxDQUFDO1NBQ0w7UUFFRCxrRkFBa0Y7UUFDbEYsdURBQXVEO1FBQ3ZELGtHQUFrRztRQUNsRyxJ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QUVLLElBQUEsNkNBQTRELEVBQTNELGdCQUFRLEVBQUUsa0JBQVUsRUFBRSxvQkFBcUMsQ0FBQztRQUNuRSxJQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFDLElBQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFOUMsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLFdBQVcsQ0FBQyxNQUFNLEVBQUU7WUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FDWCx5QkFBdUIsV0FBVyxDQUFDLE1BQU0sMkNBQXNDLGFBQWEsQ0FBQyxNQUFNLE1BQUcsQ0FBQyxDQUFDO1NBQzdHO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDM0MsT0FBTyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV2RSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxFQUFFO2dCQUMxQixNQUFNO2FBQ1A7U0FDRjtLQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIi8+XG4vLy8gPHJlZmVyZW5jZSBsaWI9XCJlczIwMTdcIi8+XG5cbmltcG9ydCB7Zm9ybWF0LCBwYXJzZVRzY29uZmlnfSBmcm9tICdAYmF6ZWwvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0V4dHJhY3RvciwgRXh0cmFjdG9yVmFsaWRhdGlvblJ1bGVQb2xpY3ksIElFeHRyYWN0b3JDb25maWcsIElFeHRyYWN0b3JPcHRpb25zfSBmcm9tICdAbWljcm9zb2Z0L2FwaS1leHRyYWN0b3InO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgREVCVUcgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk1haW4oXG4gICAgdHNDb25maWc6IHN0cmluZywgZW50cnlQb2ludDogc3RyaW5nLCBkdHNCdW5kbGVPdXQ/OiBzdHJpbmcsIGFwaVJldmlld0ZvbGRlcj86IHN0cmluZyxcbiAgICBhY2NlcHRBcGlVcGRhdGVzID0gZmFsc2UpOiAxfDAge1xuICBjb25zdCBbcGFyc2VkQ29uZmlnLCBlcnJvcnNdID0gcGFyc2VUc2NvbmZpZyh0c0NvbmZpZyk7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IoZm9ybWF0KCcnLCBlcnJvcnMpKTtcblxuICAgIHJldHVybiAxO1xuICB9XG5cbiAgY29uc3QgcGtnSnNvbiA9IHBhdGgucmVzb2x2ZShwYXRoLmRpcm5hbWUoZW50cnlQb2ludCksICdwYWNrYWdlLmpzb24nKTtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKHBrZ0pzb24pKSB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhwa2dKc29uLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAnbmFtZSc6ICdHRU5FUkFURUQtQlktQkFaRUwnLFxuICAgICAgJ3ZlcnNpb24nOiAnMC4wLjAnLFxuICAgICAgJ2Rlc2NyaXB0aW9uJzogJ1RoaXMgaXMgYSBkdW1teSBwYWNrYWdlLmpzb24gYXMgQVBJIEV4dHJhY3RvciBhbHdheXMgcmVxdWlyZXMgb25lLicsXG4gICAgfSkpO1xuICB9XG5cbiAgLy8gQVBJIGV4dHJhY3RvciBkb2Vzbid0IGFsd2F5cyBzdXBwb3J0IHRoZSB2ZXJzaW9uIG9mIFR5cGVTY3JpcHQgdXNlZCBpbiB0aGUgcmVwb1xuICAvLyBleGFtcGxlOiBhdCB0aGUgbW9tZW50IGl0IGlzIG5vdCBjb21wYXRhYmxlIHdpdGggMy4yXG4gIC8vIHRvIHVzZSB0aGUgaW50ZXJuYWwgVHlwZVNjcmlwdCB3ZSBzaGFsbCBub3QgY3JlYXRlIGEgcHJvZ3JhbSBidXQgcmF0aGVyIHBhc3MgYSBwYXJzZWQgdHNDb25maWcuXG4gIGNvbnN0IHBhcnNlZFRzQ29uZmlnID0gcGFyc2VkQ29uZmlnICEuY29uZmlnIGFzIGFueTtcbiAgY29uc3QgY29tcGlsZXJPcHRpb25zID0gcGFyc2VkVHNDb25maWcuY29tcGlsZXJPcHRpb25zO1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlc10gb2YgT2JqZWN0LmVudHJpZXM8c3RyaW5nW10+KGNvbXBpbGVyT3B0aW9ucy5wYXRocykpIHtcbiAgICBpZiAoa2V5ID09PSAnKicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHdlIHNoYWxsIG5vdCBwYXNzIHRzIGZpbGVzIGFzIHRoaXMgd2lsbCBuZWVkIHRvIGJlIHBhcnNlZCwgYW5kIGZvciBleGFtcGxlIHJ4anMsXG4gICAgLy8gY2Fubm90IGJlIGNvbXBpbGVkIHdpdGggb3VyIHRzY29uZmlnLCBhcyBvdXJzIGlzIG1vcmUgc3RyaWN0XG4gICAgLy8gaGVuY2UgYW1lbmQgdGhlIHBhdGhzIHRvIHBvaW50IGFsd2F5cyB0byB0aGUgJy5kLnRzJyBmaWxlcy5cbiAgICBjb21waWxlck9wdGlvbnMucGF0aHNba2V5XSA9IHZhbHVlcy5tYXAocGF0aCA9PiB7XG4gICAgICBjb25zdCBwYXRoU3VmZml4ID0gLyhcXCp8aW5kZXgpJC8udGVzdChwYXRoKSA/ICcuZC50cycgOiAnL2luZGV4LmQudHMnO1xuXG4gICAgICByZXR1cm4gcGF0aCArIHBhdGhTdWZmaXg7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBleHRyYWN0b3JPcHRpb25zOiBJRXh0cmFjdG9yT3B0aW9ucyA9IHtcbiAgICBsb2NhbEJ1aWxkOiBhY2NlcHRBcGlVcGRhdGVzLFxuICAgIGN1c3RvbUxvZ2dlcjogREVCVUcgPyB1bmRlZmluZWQgOiB7XG4gICAgICAvLyBkb24ndCBsb2cgdmVyYm9zZSBtZXNzYWdlcyB3aGVuIG5vdCBpbiBkZWJ1ZyBtb2RlXG4gICAgICBsb2dWZXJib3NlOiBfbWVzc2FnZSA9PiB7fVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBleHRyYWN0b3JDb25maWc6IElFeHRyYWN0b3JDb25maWcgPSB7XG4gICAgY29tcGlsZXI6IHtcbiAgICAgIGNvbmZpZ1R5cGU6ICd0c2NvbmZpZycsXG4gICAgICBvdmVycmlkZVRzY29uZmlnOiBwYXJzZWRUc0NvbmZpZyxcbiAgICAgIHJvb3RGb2xkZXI6IHBhdGgucmVzb2x2ZShwYXRoLmRpcm5hbWUodHNDb25maWcpKVxuICAgIH0sXG4gICAgcHJvamVjdDoge1xuICAgICAgZW50cnlQb2ludFNvdXJjZUZpbGU6IHBhdGgucmVzb2x2ZShlbnRyeVBvaW50KSxcbiAgICB9LFxuICAgIGFwaVJldmlld0ZpbGU6IHtcbiAgICAgIGVuYWJsZWQ6ICEhYXBpUmV2aWV3Rm9sZGVyLFxuICAgICAgYXBpUmV2aWV3Rm9sZGVyOiBhcGlSZXZpZXdGb2xkZXIgJiYgcGF0aC5yZXNvbHZlKGFwaVJldmlld0ZvbGRlciksXG4gICAgfSxcbiAgICBhcGlKc29uRmlsZToge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgfSxcbiAgICBwb2xpY2llczoge1xuICAgICAgbmFtZXNwYWNlU3VwcG9ydDogJ3Blcm1pc3NpdmUnLFxuICAgIH0sXG4gICAgdmFsaWRhdGlvblJ1bGVzOiB7XG4gICAgICBtaXNzaW5nUmVsZWFzZVRhZ3M6IEV4dHJhY3RvclZhbGlkYXRpb25SdWxlUG9saWN5LmFsbG93LFxuICAgIH0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiAhIWR0c0J1bmRsZU91dCxcbiAgICAgIHB1Ymxpc2hGb2xkZXI6IGR0c0J1bmRsZU91dCAmJiBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKGR0c0J1bmRsZU91dCkpLFxuICAgICAgbWFpbkR0c1JvbGx1cFBhdGg6IGR0c0J1bmRsZU91dCAmJiBwYXRoLmJhc2VuYW1lKGR0c0J1bmRsZU91dCksXG4gICAgfSxcbiAgICB0c2RvY01ldGFkYXRhOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yID0gbmV3IEV4dHJhY3RvcihleHRyYWN0b3JDb25maWcsIGV4dHJhY3Rvck9wdGlvbnMpO1xuICBjb25zdCBpc1N1Y2Nlc3NmdWwgPSBleHRyYWN0b3IucHJvY2Vzc1Byb2plY3QoKTtcblxuICAvLyBBUEkgZXh0cmFjdG9yIGVycm9ycyBhcmUgZW1pdHRlZCBieSBpdCdzIGxvZ2dlci5cbiAgcmV0dXJuIGlzU3VjY2Vzc2Z1bCA/IDAgOiAxO1xufVxuXG4vLyBFbnRyeSBwb2ludFxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGlmIChERUJVRykge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxuYXBpLWV4dHJhY3RvcjogcnVubmluZyB3aXRoXG4gIGN3ZDogJHtwcm9jZXNzLmN3ZCgpfVxuICBhcmd2OlxuICAgICR7cHJvY2Vzcy5hcmd2LmpvaW4oJ1xcbiAgICAnKX1cbiAgYCk7XG4gIH1cblxuICBjb25zdCBbdHNDb25maWcsIGVudHJ5UG9pbnQsIGR0c0J1bmRsZU91dF0gPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gZW50cnlQb2ludC5zcGxpdCgnLCcpO1xuICBjb25zdCBkdHNCdW5kbGVPdXRzID0gZHRzQnVuZGxlT3V0LnNwbGl0KCcsJyk7XG5cbiAgaWYgKGVudHJ5UG9pbnRzLmxlbmd0aCAhPT0gZW50cnlQb2ludHMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRW50cnkgcG9pbnRzIGNvdW50ICgke2VudHJ5UG9pbnRzLmxlbmd0aH0pIGRvZXMgbm90IG1hdGNoIEJ1bmRsZSBvdXQgY291bnQgKCR7ZHRzQnVuZGxlT3V0cy5sZW5ndGh9KWApO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRyeVBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSBydW5NYWluKHRzQ29uZmlnLCBlbnRyeVBvaW50c1tpXSwgZHRzQnVuZGxlT3V0c1tpXSk7XG5cbiAgICBpZiAocHJvY2Vzcy5leGl0Q29kZSAhPT0gMCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG4iXX0=