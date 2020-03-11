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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2QkFBNkI7SUFDN0IsNkJBQTZCO0lBRTdCLGdEQUF3RDtJQUN4RCwwREFBMEk7SUFDMUksdUJBQXlCO0lBQ3pCLDJCQUE2QjtJQUU3QixJQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFcEIsU0FBZ0IsT0FBTyxDQUNuQixRQUFnQixFQUFFLFVBQWtCLEVBQUUsWUFBcUIsRUFBRSxlQUF3QixFQUNyRixnQkFBd0I7O1FBQXhCLGlDQUFBLEVBQUEsd0JBQXdCO1FBQ3BCLElBQUEsNERBQWdELEVBQS9DLG9CQUFZLEVBQUUsY0FBaUMsQ0FBQztRQUN2RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUJBQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUVsQyxPQUFPLENBQUMsQ0FBQztTQUNWO1FBRUQsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxvQkFBb0I7Z0JBQzVCLFNBQVMsRUFBRSxPQUFPO2dCQUNsQixhQUFhLEVBQUUsb0VBQW9FO2FBQ3BGLENBQUMsQ0FBQyxDQUFDO1NBQ0w7UUFFRCxrRkFBa0Y7UUFDbEYsdURBQXVEO1FBQ3ZELGtHQUFrRztRQUNsRyxJ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QVcsQ0FBQyxNQUFNLEVBQUU7WUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FDWCx5QkFBdUIsV0FBVyxDQUFDLE1BQU0sMkNBQXNDLGFBQWEsQ0FBQyxNQUFNLE1BQUcsQ0FBQyxDQUFDO1NBQzdHO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDM0MsT0FBTyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV2RSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxFQUFFO2dCQUMxQixNQUFNO2FBQ1A7U0FDRjtLQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIi8+XG4vLy8gPHJlZmVyZW5jZSBsaWI9XCJlczIwMTdcIi8+XG5cbmltcG9ydCB7Zm9ybWF0LCBwYXJzZVRzY29uZmlnfSBmcm9tICdAYmF6ZWwvdHlwZXNjcmlwdCc7XG5pbXBvcnQge0V4dHJhY3RvciwgRXh0cmFjdG9yQ29uZmlnLCBJQ29uZmlnRmlsZSwgSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zLCBJRXh0cmFjdG9ySW52b2tlT3B0aW9uc30gZnJvbSAnQG1pY3Jvc29mdC9hcGktZXh0cmFjdG9yJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5NYWluKFxuICAgIHRzQ29uZmlnOiBzdHJpbmcsIGVudHJ5UG9pbnQ6IHN0cmluZywgZHRzQnVuZGxlT3V0Pzogc3RyaW5nLCBhcGlSZXZpZXdGb2xkZXI/OiBzdHJpbmcsXG4gICAgYWNjZXB0QXBpVXBkYXRlcyA9IGZhbHNlKTogMXwwIHtcbiAgY29uc3QgW3BhcnNlZENvbmZpZywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcodHNDb25maWcpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKGZvcm1hdCgnJywgZXJyb3JzKSk7XG5cbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIGNvbnN0IHBrZ0pzb24gPSBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKGVudHJ5UG9pbnQpLCAncGFja2FnZS5qc29uJyk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwa2dKc29uKSkge1xuICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvbiwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgJ25hbWUnOiAnR0VORVJBVEVELUJZLUJBWkVMJyxcbiAgICAgICd2ZXJzaW9uJzogJzAuMC4wJyxcbiAgICAgICdkZXNjcmlwdGlvbic6ICdUaGlzIGlzIGEgZHVtbXkgcGFja2FnZS5qc29uIGFzIEFQSSBFeHRyYWN0b3IgYWx3YXlzIHJlcXVpcmVzIG9uZS4nLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8vIEFQSSBleHRyYWN0b3IgZG9lc24ndCBhbHdheXMgc3VwcG9ydCB0aGUgdmVyc2lvbiBvZiBUeXBlU2NyaXB0IHVzZWQgaW4gdGhlIHJlcG9cbiAgLy8gZXhhbXBsZTogYXQgdGhlIG1vbWVudCBpdCBpcyBub3QgY29tcGF0YWJsZSB3aXRoIDMuMlxuICAvLyB0byB1c2UgdGhlIGludGVybmFsIFR5cGVTY3JpcHQgd2Ugc2hhbGwgbm90IGNyZWF0ZSBhIHByb2dyYW0gYnV0IHJhdGhlciBwYXNzIGEgcGFyc2VkIHRzQ29uZmlnLlxuICBjb25zdCBwYXJzZWRUc0NvbmZpZyA9IHBhcnNlZENvbmZpZyAhLmNvbmZpZyBhcyBhbnk7XG4gIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9IHBhcnNlZFRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucztcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZXNdIG9mIE9iamVjdC5lbnRyaWVzPHN0cmluZ1tdPihjb21waWxlck9wdGlvbnMucGF0aHMpKSB7XG4gICAgaWYgKGtleSA9PT0gJyonKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB3ZSBzaGFsbCBub3QgcGFzcyB0cyBmaWxlcyBhcyB0aGlzIHdpbGwgbmVlZCB0byBiZSBwYXJzZWQsIGFuZCBmb3IgZXhhbXBsZSByeGpzLFxuICAgIC8vIGNhbm5vdCBiZSBjb21waWxlZCB3aXRoIG91ciB0c2NvbmZpZywgYXMgb3VycyBpcyBtb3JlIHN0cmljdFxuICAgIC8vIGhlbmNlIGFtZW5kIHRoZSBwYXRocyB0byBwb2ludCBhbHdheXMgdG8gdGhlICcuZC50cycgZmlsZXMuXG4gICAgY29tcGlsZXJPcHRpb25zLnBhdGhzW2tleV0gPSB2YWx1ZXMubWFwKHBhdGggPT4ge1xuICAgICAgY29uc3QgcGF0aFN1ZmZpeCA9IC8oXFwqfGluZGV4KSQvLnRlc3QocGF0aCkgPyAnLmQudHMnIDogJy9pbmRleC5kLnRzJztcblxuICAgICAgcmV0dXJuIHBhdGggKyBwYXRoU3VmZml4O1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZXh0cmFjdG9yT3B0aW9uczogSUV4dHJhY3Rvckludm9rZU9wdGlvbnMgPSB7XG4gICAgbG9jYWxCdWlsZDogYWNjZXB0QXBpVXBkYXRlcyxcbiAgfTtcblxuICBjb25zdCBjb25maWdPYmplY3Q6IElDb25maWdGaWxlID0ge1xuICAgIGNvbXBpbGVyOiB7XG4gICAgICBvdmVycmlkZVRzY29uZmlnOiBwYXJzZWRUc0NvbmZpZyxcbiAgICB9LFxuICAgIHByb2plY3RGb2xkZXI6IHBhdGgucmVzb2x2ZShwYXRoLmRpcm5hbWUodHNDb25maWcpKSxcbiAgICBtYWluRW50cnlQb2ludEZpbGVQYXRoOiBwYXRoLnJlc29sdmUoZW50cnlQb2ludCksXG4gICAgYXBpUmVwb3J0OiB7XG4gICAgICBlbmFibGVkOiAhIWFwaVJldmlld0ZvbGRlcixcbiAgICAgIC8vIFRPRE8oYWxhbi1hZ2l1czQpOiByZW1vdmUgdGhpcyBmb2xkZXIgbmFtZSB3aGVuIHRoZSBiZWxvdyBpc3N1ZSBpcyBzb2x2ZWQgdXBzdHJlYW1cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC93ZWItYnVpbGQtdG9vbHMvaXNzdWVzLzE0NzBcbiAgICAgIHJlcG9ydEZpbGVOYW1lOiBhcGlSZXZpZXdGb2xkZXIgJiYgcGF0aC5yZXNvbHZlKGFwaVJldmlld0ZvbGRlcikgfHwgJ2ludmFsaWQnLFxuICAgIH0sXG4gICAgZG9jTW9kZWw6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiAhIWR0c0J1bmRsZU91dCxcbiAgICAgIHVudHJpbW1lZEZpbGVQYXRoOiBkdHNCdW5kbGVPdXQgJiYgcGF0aC5yZXNvbHZlKGR0c0J1bmRsZU91dCksXG4gICAgfSxcbiAgICB0c2RvY01ldGFkYXRhOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgb3B0aW9uczogSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zID0ge1xuICAgIGNvbmZpZ09iamVjdCxcbiAgICBwYWNrYWdlSnNvbjogdW5kZWZpbmVkLFxuICAgIHBhY2thZ2VKc29uRnVsbFBhdGg6IHBrZ0pzb24sXG4gICAgY29uZmlnT2JqZWN0RnVsbFBhdGg6IHVuZGVmaW5lZCxcbiAgfTtcblxuICBjb25zdCBleHRyYWN0b3JDb25maWcgPSBFeHRyYWN0b3JDb25maWcucHJlcGFyZShvcHRpb25zKTtcbiAgY29uc3Qge3N1Y2NlZWRlZH0gPSBFeHRyYWN0b3IuaW52b2tlKGV4dHJhY3RvckNvbmZpZywgZXh0cmFjdG9yT3B0aW9ucyk7XG5cbiAgLy8gQVBJIGV4dHJhY3RvciBlcnJvcnMgYXJlIGVtaXR0ZWQgYnkgaXQncyBsb2dnZXIuXG4gIHJldHVybiBzdWNjZWVkZWQgPyAwIDogMTtcbn1cblxuLy8gRW50cnkgcG9pbnRcbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBpZiAoREVCVUcpIHtcbiAgICBjb25zb2xlLmVycm9yKGBcbmFwaS1leHRyYWN0b3I6IHJ1bm5pbmcgd2l0aFxuICBjd2Q6ICR7cHJvY2Vzcy5jd2QoKX1cbiAgYXJndjpcbiAgICAke3Byb2Nlc3MuYXJndi5qb2luKCdcXG4gICAgJyl9XG4gIGApO1xuICB9XG5cbiAgY29uc3QgW3RzQ29uZmlnLCBlbnRyeVBvaW50LCBkdHNCdW5kbGVPdXRdID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICBjb25zdCBlbnRyeVBvaW50cyA9IGVudHJ5UG9pbnQuc3BsaXQoJywnKTtcbiAgY29uc3QgZHRzQnVuZGxlT3V0cyA9IGR0c0J1bmRsZU91dC5zcGxpdCgnLCcpO1xuXG4gIGlmIChlbnRyeVBvaW50cy5sZW5ndGggIT09IGVudHJ5UG9pbnRzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEVudHJ5IHBvaW50cyBjb3VudCAoJHtlbnRyeVBvaW50cy5sZW5ndGh9KSBkb2VzIG5vdCBtYXRjaCBCdW5kbGUgb3V0IGNvdW50ICgke2R0c0J1bmRsZU91dHMubGVuZ3RofSlgKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZW50cnlQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICBwcm9jZXNzLmV4aXRDb2RlID0gcnVuTWFpbih0c0NvbmZpZywgZW50cnlQb2ludHNbaV0sIGR0c0J1bmRsZU91dHNbaV0pO1xuXG4gICAgaWYgKHByb2Nlc3MuZXhpdENvZGUgIT09IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuIl19