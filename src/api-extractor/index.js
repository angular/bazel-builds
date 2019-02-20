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
        if (acceptApiUpdates === void 0) { acceptApiUpdates = false; }
        var e_1, _a;
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
        process.exitCode = runMain(tsConfig, entryPoint, dtsBundleOut);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2QkFBNkI7SUFDN0IsNkJBQTZCO0lBRTdCLGdEQUF3RDtJQUN4RCwwREFBdUg7SUFDdkgsdUJBQXlCO0lBQ3pCLDJCQUE2QjtJQUU3QixJQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFcEIsU0FBZ0IsT0FBTyxDQUNuQixRQUFnQixFQUFFLFVBQWtCLEVBQUUsWUFBcUIsRUFBRSxlQUF3QixFQUNyRixnQkFBd0I7UUFBeEIsaUNBQUEsRUFBQSx3QkFBd0I7O1FBQ3BCLElBQUEsNERBQWdELEVBQS9DLG9CQUFZLEVBQUUsY0FBaUMsQ0FBQztRQUN2RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUJBQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUVsQyxPQUFPLENBQUMsQ0FBQztTQUNWO1FBRUQsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxvQkFBb0I7Z0JBQzVCLFNBQVMsRUFBRSxPQUFPO2dCQUNsQixhQUFhLEVBQUUsb0VBQW9FO2FBQ3BGLENBQUMsQ0FBQyxDQUFDO1NBQ0w7UUFFRCxrRkFBa0Y7UUFDbEYsdURBQXVEO1FBQ3ZELGtHQUFrRztRQUNsRyxJ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QUUsb0JBQXFDLENBQUM7UUFDbkUsT0FBTyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztLQUNoRSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIvPlxuLy8vIDxyZWZlcmVuY2UgbGliPVwiZXMyMDE3XCIvPlxuXG5pbXBvcnQge2Zvcm1hdCwgcGFyc2VUc2NvbmZpZ30gZnJvbSAnQGJhemVsL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtFeHRyYWN0b3IsIEV4dHJhY3RvclZhbGlkYXRpb25SdWxlUG9saWN5LCBJRXh0cmFjdG9yQ29uZmlnLCBJRXh0cmFjdG9yT3B0aW9uc30gZnJvbSAnQG1pY3Jvc29mdC9hcGktZXh0cmFjdG9yJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5NYWluKFxuICAgIHRzQ29uZmlnOiBzdHJpbmcsIGVudHJ5UG9pbnQ6IHN0cmluZywgZHRzQnVuZGxlT3V0Pzogc3RyaW5nLCBhcGlSZXZpZXdGb2xkZXI/OiBzdHJpbmcsXG4gICAgYWNjZXB0QXBpVXBkYXRlcyA9IGZhbHNlKTogMXwwIHtcbiAgY29uc3QgW3BhcnNlZENvbmZpZywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcodHNDb25maWcpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKGZvcm1hdCgnJywgZXJyb3JzKSk7XG5cbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIGNvbnN0IHBrZ0pzb24gPSBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKGVudHJ5UG9pbnQpLCAncGFja2FnZS5qc29uJyk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwa2dKc29uKSkge1xuICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvbiwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgJ25hbWUnOiAnR0VORVJBVEVELUJZLUJBWkVMJyxcbiAgICAgICd2ZXJzaW9uJzogJzAuMC4wJyxcbiAgICAgICdkZXNjcmlwdGlvbic6ICdUaGlzIGlzIGEgZHVtbXkgcGFja2FnZS5qc29uIGFzIEFQSSBFeHRyYWN0b3IgYWx3YXlzIHJlcXVpcmVzIG9uZS4nLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8vIEFQSSBleHRyYWN0b3IgZG9lc24ndCBhbHdheXMgc3VwcG9ydCB0aGUgdmVyc2lvbiBvZiBUeXBlU2NyaXB0IHVzZWQgaW4gdGhlIHJlcG9cbiAgLy8gZXhhbXBsZTogYXQgdGhlIG1vbWVudCBpdCBpcyBub3QgY29tcGF0YWJsZSB3aXRoIDMuMlxuICAvLyB0byB1c2UgdGhlIGludGVybmFsIFR5cGVTY3JpcHQgd2Ugc2hhbGwgbm90IGNyZWF0ZSBhIHByb2dyYW0gYnV0IHJhdGhlciBwYXNzIGEgcGFyc2VkIHRzQ29uZmlnLlxuICBjb25zdCBwYXJzZWRUc0NvbmZpZyA9IHBhcnNlZENvbmZpZyAhLmNvbmZpZyBhcyBhbnk7XG4gIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9IHBhcnNlZFRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucztcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZXNdIG9mIE9iamVjdC5lbnRyaWVzPHN0cmluZ1tdPihjb21waWxlck9wdGlvbnMucGF0aHMpKSB7XG4gICAgaWYgKGtleSA9PT0gJyonKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB3ZSBzaGFsbCBub3QgcGFzcyB0cyBmaWxlcyBhcyB0aGlzIHdpbGwgbmVlZCB0byBiZSBwYXJzZWQsIGFuZCBmb3IgZXhhbXBsZSByeGpzLFxuICAgIC8vIGNhbm5vdCBiZSBjb21waWxlZCB3aXRoIG91ciB0c2NvbmZpZywgYXMgb3VycyBpcyBtb3JlIHN0cmljdFxuICAgIC8vIGhlbmNlIGFtZW5kIHRoZSBwYXRocyB0byBwb2ludCBhbHdheXMgdG8gdGhlICcuZC50cycgZmlsZXMuXG4gICAgY29tcGlsZXJPcHRpb25zLnBhdGhzW2tleV0gPSB2YWx1ZXMubWFwKHBhdGggPT4ge1xuICAgICAgY29uc3QgcGF0aFN1ZmZpeCA9IC8oXFwqfGluZGV4KSQvLnRlc3QocGF0aCkgPyAnLmQudHMnIDogJy9pbmRleC5kLnRzJztcblxuICAgICAgcmV0dXJuIHBhdGggKyBwYXRoU3VmZml4O1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZXh0cmFjdG9yT3B0aW9uczogSUV4dHJhY3Rvck9wdGlvbnMgPSB7XG4gICAgbG9jYWxCdWlsZDogYWNjZXB0QXBpVXBkYXRlcyxcbiAgICBjdXN0b21Mb2dnZXI6IERFQlVHID8gdW5kZWZpbmVkIDoge1xuICAgICAgLy8gZG9uJ3QgbG9nIHZlcmJvc2UgbWVzc2FnZXMgd2hlbiBub3QgaW4gZGVidWcgbW9kZVxuICAgICAgbG9nVmVyYm9zZTogX21lc3NhZ2UgPT4ge31cbiAgICB9XG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yQ29uZmlnOiBJRXh0cmFjdG9yQ29uZmlnID0ge1xuICAgIGNvbXBpbGVyOiB7XG4gICAgICBjb25maWdUeXBlOiAndHNjb25maWcnLFxuICAgICAgb3ZlcnJpZGVUc2NvbmZpZzogcGFyc2VkVHNDb25maWcsXG4gICAgICByb290Rm9sZGVyOiBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKHRzQ29uZmlnKSlcbiAgICB9LFxuICAgIHByb2plY3Q6IHtcbiAgICAgIGVudHJ5UG9pbnRTb3VyY2VGaWxlOiBwYXRoLnJlc29sdmUoZW50cnlQb2ludCksXG4gICAgfSxcbiAgICBhcGlSZXZpZXdGaWxlOiB7XG4gICAgICBlbmFibGVkOiAhIWFwaVJldmlld0ZvbGRlcixcbiAgICAgIGFwaVJldmlld0ZvbGRlcjogYXBpUmV2aWV3Rm9sZGVyICYmIHBhdGgucmVzb2x2ZShhcGlSZXZpZXdGb2xkZXIpLFxuICAgIH0sXG4gICAgYXBpSnNvbkZpbGU6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgcG9saWNpZXM6IHtcbiAgICAgIG5hbWVzcGFjZVN1cHBvcnQ6ICdwZXJtaXNzaXZlJyxcbiAgICB9LFxuICAgIHZhbGlkYXRpb25SdWxlczoge1xuICAgICAgbWlzc2luZ1JlbGVhc2VUYWdzOiBFeHRyYWN0b3JWYWxpZGF0aW9uUnVsZVBvbGljeS5hbGxvdyxcbiAgICB9LFxuICAgIGR0c1JvbGx1cDoge1xuICAgICAgZW5hYmxlZDogISFkdHNCdW5kbGVPdXQsXG4gICAgICBwdWJsaXNoRm9sZGVyOiBkdHNCdW5kbGVPdXQgJiYgcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZShkdHNCdW5kbGVPdXQpKSxcbiAgICAgIG1haW5EdHNSb2xsdXBQYXRoOiBkdHNCdW5kbGVPdXQgJiYgcGF0aC5iYXNlbmFtZShkdHNCdW5kbGVPdXQpLFxuICAgIH1cbiAgfTtcblxuICBjb25zdCBleHRyYWN0b3IgPSBuZXcgRXh0cmFjdG9yKGV4dHJhY3RvckNvbmZpZywgZXh0cmFjdG9yT3B0aW9ucyk7XG4gIGNvbnN0IGlzU3VjY2Vzc2Z1bCA9IGV4dHJhY3Rvci5wcm9jZXNzUHJvamVjdCgpO1xuXG4gIC8vIEFQSSBleHRyYWN0b3IgZXJyb3JzIGFyZSBlbWl0dGVkIGJ5IGl0J3MgbG9nZ2VyLlxuICByZXR1cm4gaXNTdWNjZXNzZnVsID8gMCA6IDE7XG59XG5cbi8vIEVudHJ5IHBvaW50XG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgaWYgKERFQlVHKSB7XG4gICAgY29uc29sZS5lcnJvcihgXG5hcGktZXh0cmFjdG9yOiBydW5uaW5nIHdpdGhcbiAgY3dkOiAke3Byb2Nlc3MuY3dkKCl9XG4gIGFyZ3Y6XG4gICAgJHtwcm9jZXNzLmFyZ3Yuam9pbignXFxuICAgICcpfVxuICBgKTtcbiAgfVxuXG4gIGNvbnN0IFt0c0NvbmZpZywgZW50cnlQb2ludCwgZHRzQnVuZGxlT3V0XSA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcbiAgcHJvY2Vzcy5leGl0Q29kZSA9IHJ1bk1haW4odHNDb25maWcsIGVudHJ5UG9pbnQsIGR0c0J1bmRsZU91dCk7XG59XG4iXX0=