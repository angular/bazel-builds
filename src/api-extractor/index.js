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
    exports.runMain = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLDZCQUE2QjtJQUU3QixnREFBd0Q7SUFDeEQsMERBQTBJO0lBQzFJLHVCQUF5QjtJQUN6QiwyQkFBNkI7SUFFN0IsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDO0lBRXBCLFNBQWdCLE9BQU8sQ0FDbkIsUUFBZ0IsRUFBRSxVQUFrQixFQUFFLFlBQXFCLEVBQUUsZUFBd0IsRUFDckYsZ0JBQXdCOztRQUF4QixpQ0FBQSxFQUFBLHdCQUF3QjtRQUNwQixJQUFBLEtBQUEsZUFBeUIsMEJBQWEsQ0FBQyxRQUFRLENBQUMsSUFBQSxFQUEvQyxZQUFZLFFBQUEsRUFBRSxNQUFNLFFBQTJCLENBQUM7UUFDdkQsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLG1CQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFFbEMsT0FBTyxDQUFDLENBQUM7U0FDVjtRQUVELElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUMzQixFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN2QyxNQUFNLEVBQUUsb0JBQW9CO2dCQUM1QixTQUFTLEVBQUUsT0FBTztnQkFDbEIsYUFBYSxFQUFFLG9FQUFvRTthQUNwRixDQUFDLENBQUMsQ0FBQztTQUNMO1FBRUQsa0ZBQWtGO1FBQ2xGLHVEQUF1RDtRQUN2RCxrR0FBa0c7UUFDbEcsSUFBTSxjQUFjLEdBQUcsWUFBYSxDQUFDLE1BQWEsQ0FBQztRQUNuRCxJQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsZUFBZSxDQUFDOztZQUN2RCxLQUE0QixJQUFBLEtBQUEsaUJBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBVyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUEsZ0JBQUEsNEJBQUU7Z0JBQWxFLElBQUEsS0FBQSwyQkFBYSxFQUFaLEdBQUcsUUFBQSxFQUFFLE1BQU0sUUFBQTtnQkFDckIsSUFBSSxHQUFHLEtBQUssR0FBRyxFQUFFO29CQUNmLFNBQVM7aUJBQ1Y7Z0JBRUQsbUZBQW1GO2dCQUNuRiwrREFBK0Q7Z0JBQy9ELDhEQUE4RDtnQkFDOUQsZUFBZSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSTtvQkFDMUMsSUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7b0JBRXRFLE9BQU8sSUFBSSxHQUFHLFVBQVUsQ0FBQztnQkFDM0IsQ0FBQyxDQUFDLENBQUM7YUFDSjs7Ozs7Ozs7O1FBRUQsSUFBTSxnQkFBZ0IsR0FBNEI7WUFDaEQsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDO1FBRUYsSUFBTSxZQUFZLEdBQWdCO1lBQ2hDLFFBQVEsRUFBRTtnQkFDUixnQkFBZ0IsRUFBRSxjQUFjO2FBQ2pDO1lBQ0QsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuRCxzQkFBc0IsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztZQUNoRCxTQUFTLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLENBQUMsQ0FBQyxlQUFlO2dCQUMxQixxRkFBcUY7Z0JBQ3JGLGdFQUFnRTtnQkFDaEUsY0FBYyxFQUFFLGVBQWUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLFNBQVM7YUFDOUU7WUFDRCxRQUFRLEVBQUU7Z0JBQ1IsT0FBTyxFQUFFLEtBQUs7YUFDZjtZQUNELFNBQVMsRUFBRTtnQkFDVCxPQUFPLEVBQUUsQ0FBQyxDQUFDLFlBQVk7Z0JBQ3ZCLGlCQUFpQixFQUFFLFlBQVksSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQzthQUM5RDtZQUNELGFBQWEsRUFBRTtnQkFDYixPQUFPLEVBQUUsS0FBSzthQUNmO1NBQ0YsQ0FBQztRQUVGLElBQU0sT0FBTyxHQUFtQztZQUM5QyxZQUFZLGNBQUE7WUFDWixXQUFXLEVBQUUsU0FBUztZQUN0QixtQkFBbUIsRUFBRSxPQUFPO1lBQzVCLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FBQztRQUVGLElBQU0sZUFBZSxHQUFHLCtCQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xELElBQUEsU0FBUyxHQUFJLHlCQUFTLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxVQUF2RCxDQUF3RDtRQUV4RSxtREFBbUQ7UUFDbkQsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUEvRUQsMEJBK0VDO0lBRUQsY0FBYztJQUNkLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsSUFBSSxLQUFLLEVBQUU7WUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDLDJDQUVULE9BQU8sQ0FBQyxHQUFHLEVBQUUsdUJBRWhCLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUM5QixDQUFDLENBQUM7U0FDRjtRQUVLLElBQUEsS0FBQSxlQUF1QyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBQSxFQUEzRCxRQUFRLFFBQUEsRUFBRSxVQUFVLFFBQUEsRUFBRSxZQUFZLFFBQXlCLENBQUM7UUFDbkUsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxQyxJQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTlDLElBQUksV0FBVyxDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsTUFBTSxFQUFFO1lBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXVCLFdBQVcsQ0FBQyxNQUFNLDJDQUNyRCxhQUFhLENBQUMsTUFBTSxNQUFHLENBQUMsQ0FBQztTQUM5QjtRQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzNDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdkUsSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLENBQUMsRUFBRTtnQkFDMUIsTUFBTTthQUNQO1NBQ0Y7S0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIvPlxuLy8vIDxyZWZlcmVuY2UgbGliPVwiZXMyMDE3XCIvPlxuXG5pbXBvcnQge2Zvcm1hdCwgcGFyc2VUc2NvbmZpZ30gZnJvbSAnQGJhemVsL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtFeHRyYWN0b3IsIEV4dHJhY3RvckNvbmZpZywgSUNvbmZpZ0ZpbGUsIElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucywgSUV4dHJhY3Rvckludm9rZU9wdGlvbnN9IGZyb20gJ0BtaWNyb3NvZnQvYXBpLWV4dHJhY3Rvcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBERUJVRyA9IGZhbHNlO1xuXG5leHBvcnQgZnVuY3Rpb24gcnVuTWFpbihcbiAgICB0c0NvbmZpZzogc3RyaW5nLCBlbnRyeVBvaW50OiBzdHJpbmcsIGR0c0J1bmRsZU91dD86IHN0cmluZywgYXBpUmV2aWV3Rm9sZGVyPzogc3RyaW5nLFxuICAgIGFjY2VwdEFwaVVwZGF0ZXMgPSBmYWxzZSk6IDF8MCB7XG4gIGNvbnN0IFtwYXJzZWRDb25maWcsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHRzQ29uZmlnKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihmb3JtYXQoJycsIGVycm9ycykpO1xuXG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICBjb25zdCBwa2dKc29uID0gcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZShlbnRyeVBvaW50KSwgJ3BhY2thZ2UuanNvbicpO1xuICBpZiAoIWZzLmV4aXN0c1N5bmMocGtnSnNvbikpIHtcbiAgICBmcy53cml0ZUZpbGVTeW5jKHBrZ0pzb24sIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICduYW1lJzogJ0dFTkVSQVRFRC1CWS1CQVpFTCcsXG4gICAgICAndmVyc2lvbic6ICcwLjAuMCcsXG4gICAgICAnZGVzY3JpcHRpb24nOiAnVGhpcyBpcyBhIGR1bW15IHBhY2thZ2UuanNvbiBhcyBBUEkgRXh0cmFjdG9yIGFsd2F5cyByZXF1aXJlcyBvbmUuJyxcbiAgICB9KSk7XG4gIH1cblxuICAvLyBBUEkgZXh0cmFjdG9yIGRvZXNuJ3QgYWx3YXlzIHN1cHBvcnQgdGhlIHZlcnNpb24gb2YgVHlwZVNjcmlwdCB1c2VkIGluIHRoZSByZXBvXG4gIC8vIGV4YW1wbGU6IGF0IHRoZSBtb21lbnQgaXQgaXMgbm90IGNvbXBhdGFibGUgd2l0aCAzLjJcbiAgLy8gdG8gdXNlIHRoZSBpbnRlcm5hbCBUeXBlU2NyaXB0IHdlIHNoYWxsIG5vdCBjcmVhdGUgYSBwcm9ncmFtIGJ1dCByYXRoZXIgcGFzcyBhIHBhcnNlZCB0c0NvbmZpZy5cbiAgY29uc3QgcGFyc2VkVHNDb25maWcgPSBwYXJzZWRDb25maWchLmNvbmZpZyBhcyBhbnk7XG4gIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9IHBhcnNlZFRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucztcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZXNdIG9mIE9iamVjdC5lbnRyaWVzPHN0cmluZ1tdPihjb21waWxlck9wdGlvbnMucGF0aHMpKSB7XG4gICAgaWYgKGtleSA9PT0gJyonKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB3ZSBzaGFsbCBub3QgcGFzcyB0cyBmaWxlcyBhcyB0aGlzIHdpbGwgbmVlZCB0byBiZSBwYXJzZWQsIGFuZCBmb3IgZXhhbXBsZSByeGpzLFxuICAgIC8vIGNhbm5vdCBiZSBjb21waWxlZCB3aXRoIG91ciB0c2NvbmZpZywgYXMgb3VycyBpcyBtb3JlIHN0cmljdFxuICAgIC8vIGhlbmNlIGFtZW5kIHRoZSBwYXRocyB0byBwb2ludCBhbHdheXMgdG8gdGhlICcuZC50cycgZmlsZXMuXG4gICAgY29tcGlsZXJPcHRpb25zLnBhdGhzW2tleV0gPSB2YWx1ZXMubWFwKHBhdGggPT4ge1xuICAgICAgY29uc3QgcGF0aFN1ZmZpeCA9IC8oXFwqfGluZGV4KSQvLnRlc3QocGF0aCkgPyAnLmQudHMnIDogJy9pbmRleC5kLnRzJztcblxuICAgICAgcmV0dXJuIHBhdGggKyBwYXRoU3VmZml4O1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZXh0cmFjdG9yT3B0aW9uczogSUV4dHJhY3Rvckludm9rZU9wdGlvbnMgPSB7XG4gICAgbG9jYWxCdWlsZDogYWNjZXB0QXBpVXBkYXRlcyxcbiAgfTtcblxuICBjb25zdCBjb25maWdPYmplY3Q6IElDb25maWdGaWxlID0ge1xuICAgIGNvbXBpbGVyOiB7XG4gICAgICBvdmVycmlkZVRzY29uZmlnOiBwYXJzZWRUc0NvbmZpZyxcbiAgICB9LFxuICAgIHByb2plY3RGb2xkZXI6IHBhdGgucmVzb2x2ZShwYXRoLmRpcm5hbWUodHNDb25maWcpKSxcbiAgICBtYWluRW50cnlQb2ludEZpbGVQYXRoOiBwYXRoLnJlc29sdmUoZW50cnlQb2ludCksXG4gICAgYXBpUmVwb3J0OiB7XG4gICAgICBlbmFibGVkOiAhIWFwaVJldmlld0ZvbGRlcixcbiAgICAgIC8vIFRPRE8oYWxhbi1hZ2l1czQpOiByZW1vdmUgdGhpcyBmb2xkZXIgbmFtZSB3aGVuIHRoZSBiZWxvdyBpc3N1ZSBpcyBzb2x2ZWQgdXBzdHJlYW1cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC93ZWItYnVpbGQtdG9vbHMvaXNzdWVzLzE0NzBcbiAgICAgIHJlcG9ydEZpbGVOYW1lOiBhcGlSZXZpZXdGb2xkZXIgJiYgcGF0aC5yZXNvbHZlKGFwaVJldmlld0ZvbGRlcikgfHwgJ2ludmFsaWQnLFxuICAgIH0sXG4gICAgZG9jTW9kZWw6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiAhIWR0c0J1bmRsZU91dCxcbiAgICAgIHVudHJpbW1lZEZpbGVQYXRoOiBkdHNCdW5kbGVPdXQgJiYgcGF0aC5yZXNvbHZlKGR0c0J1bmRsZU91dCksXG4gICAgfSxcbiAgICB0c2RvY01ldGFkYXRhOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgb3B0aW9uczogSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zID0ge1xuICAgIGNvbmZpZ09iamVjdCxcbiAgICBwYWNrYWdlSnNvbjogdW5kZWZpbmVkLFxuICAgIHBhY2thZ2VKc29uRnVsbFBhdGg6IHBrZ0pzb24sXG4gICAgY29uZmlnT2JqZWN0RnVsbFBhdGg6IHVuZGVmaW5lZCxcbiAgfTtcblxuICBjb25zdCBleHRyYWN0b3JDb25maWcgPSBFeHRyYWN0b3JDb25maWcucHJlcGFyZShvcHRpb25zKTtcbiAgY29uc3Qge3N1Y2NlZWRlZH0gPSBFeHRyYWN0b3IuaW52b2tlKGV4dHJhY3RvckNvbmZpZywgZXh0cmFjdG9yT3B0aW9ucyk7XG5cbiAgLy8gQVBJIGV4dHJhY3RvciBlcnJvcnMgYXJlIGVtaXR0ZWQgYnkgaXQncyBsb2dnZXIuXG4gIHJldHVybiBzdWNjZWVkZWQgPyAwIDogMTtcbn1cblxuLy8gRW50cnkgcG9pbnRcbmlmIChyZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBpZiAoREVCVUcpIHtcbiAgICBjb25zb2xlLmVycm9yKGBcbmFwaS1leHRyYWN0b3I6IHJ1bm5pbmcgd2l0aFxuICBjd2Q6ICR7cHJvY2Vzcy5jd2QoKX1cbiAgYXJndjpcbiAgICAke3Byb2Nlc3MuYXJndi5qb2luKCdcXG4gICAgJyl9XG4gIGApO1xuICB9XG5cbiAgY29uc3QgW3RzQ29uZmlnLCBlbnRyeVBvaW50LCBkdHNCdW5kbGVPdXRdID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICBjb25zdCBlbnRyeVBvaW50cyA9IGVudHJ5UG9pbnQuc3BsaXQoJywnKTtcbiAgY29uc3QgZHRzQnVuZGxlT3V0cyA9IGR0c0J1bmRsZU91dC5zcGxpdCgnLCcpO1xuXG4gIGlmIChlbnRyeVBvaW50cy5sZW5ndGggIT09IGVudHJ5UG9pbnRzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRW50cnkgcG9pbnRzIGNvdW50ICgke2VudHJ5UG9pbnRzLmxlbmd0aH0pIGRvZXMgbm90IG1hdGNoIEJ1bmRsZSBvdXQgY291bnQgKCR7XG4gICAgICAgIGR0c0J1bmRsZU91dHMubGVuZ3RofSlgKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZW50cnlQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICBwcm9jZXNzLmV4aXRDb2RlID0gcnVuTWFpbih0c0NvbmZpZywgZW50cnlQb2ludHNbaV0sIGR0c0J1bmRsZU91dHNbaV0pO1xuXG4gICAgaWYgKHByb2Nlc3MuZXhpdENvZGUgIT09IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuIl19