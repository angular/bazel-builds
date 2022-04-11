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
        define("angular/packages/bazel/src/api-extractor/index", ["require", "exports", "tslib", "@bazel/concatjs/internal/tsc_wrapped", "@microsoft/api-extractor", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runMain = void 0;
    const tslib_1 = require("tslib");
    /// <reference types="node"/>
    /// <reference lib="es2017"/>
    // `tsc-wrapped` helpers are not exposed in the primary `@bazel/concatjs` entry-point.
    // TODO: Update when https://github.com/bazelbuild/rules_nodejs/pull/3286 is available.
    const tsc_wrapped_1 = require("@bazel/concatjs/internal/tsc_wrapped");
    const api_extractor_1 = require("@microsoft/api-extractor");
    const fs = tslib_1.__importStar(require("fs"));
    const path = tslib_1.__importStar(require("path"));
    const DEBUG = false;
    function runMain(tsConfig, entryPointExecPath, dtsBundleOut, apiReviewFolder, acceptApiUpdates = false) {
        const [parsedConfig, errors] = (0, tsc_wrapped_1.parseTsconfig)(tsConfig);
        if (errors && errors.length) {
            console.error((0, tsc_wrapped_1.format)('', errors));
            return 1;
        }
        const pkgJson = path.resolve(path.dirname(entryPointExecPath), 'package.json');
        if (!fs.existsSync(pkgJson)) {
            fs.writeFileSync(pkgJson, JSON.stringify({
                'name': 'GENERATED-BY-BAZEL',
                'version': '0.0.0',
                'description': 'This is a dummy package.json as API Extractor always requires one.',
            }));
        }
        const parsedTsConfig = parsedConfig.config;
        const compilerOptions = parsedTsConfig.compilerOptions;
        // We omit all path mappings from the compilation tsconfig. In Angular APF, all module imports
        // are considered external and should be preserved. i.e. not bundled into the dts rollup.
        compilerOptions.paths = [];
        const extractorOptions = {
            localBuild: acceptApiUpdates,
        };
        const configObject = {
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
        const options = {
            configObject,
            packageJson: undefined,
            packageJsonFullPath: pkgJson,
            configObjectFullPath: undefined,
        };
        const extractorConfig = api_extractor_1.ExtractorConfig.prepare(options);
        const { succeeded } = api_extractor_1.Extractor.invoke(extractorConfig, extractorOptions);
        // API extractor errors are emitted by it's logger.
        return succeeded ? 0 : 1;
    }
    exports.runMain = runMain;
    // Entry point
    if (require.main === module) {
        if (DEBUG) {
            console.error(`
api-extractor: running with
  cwd: ${process.cwd()}
  argv:
    ${process.argv.join('\n    ')}
  `);
        }
        const [tsConfig, entryPointExecPath, outputExecPath] = process.argv.slice(2);
        process.exitCode = runMain(tsConfig, entryPointExecPath, outputExecPath);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLDZCQUE2QjtJQUU3QixzRkFBc0Y7SUFDdEYsdUZBQXVGO0lBQ3ZGLHNFQUEyRTtJQUMzRSw0REFBMEk7SUFDMUksK0NBQXlCO0lBQ3pCLG1EQUE2QjtJQUU3QixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFcEIsU0FBZ0IsT0FBTyxDQUNuQixRQUFnQixFQUFFLGtCQUEwQixFQUFFLFlBQW9CLEVBQUUsZUFBd0IsRUFDNUYsZ0JBQWdCLEdBQUcsS0FBSztRQUMxQixNQUFNLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUEsMkJBQWEsRUFBQyxRQUFRLENBQUMsQ0FBQztRQUN2RCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBQSxvQkFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBRWxDLE9BQU8sQ0FBQyxDQUFDO1NBQ1Y7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUMzQixFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN2QyxNQUFNLEVBQUUsb0JBQW9CO2dCQUM1QixTQUFTLEVBQUUsT0FBTztnQkFDbEIsYUFBYSxFQUFFLG9FQUFvRTthQUNwRixDQUFDLENBQUMsQ0FBQztTQUNMO1FBRUQsTUFBTSxjQUFjLEdBQUcsWUFBYSxDQUFDLE1BQWEsQ0FBQztRQUNuRCxNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsZUFBZSxDQUFDO1FBRXZELDhGQUE4RjtRQUM5Rix5RkFBeUY7UUFDekYsZUFBZSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7UUFFM0IsTUFBTSxnQkFBZ0IsR0FBNEI7WUFDaEQsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQWdCO1lBQ2hDLFFBQVEsRUFBRTtnQkFDUixnQkFBZ0IsRUFBRSxjQUFjO2FBQ2pDO1lBQ0QsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuRCxzQkFBc0IsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQ3hELFNBQVMsRUFBRTtnQkFDVCxPQUFPLEVBQUUsQ0FBQyxDQUFDLGVBQWU7Z0JBQzFCLHFGQUFxRjtnQkFDckYsZ0VBQWdFO2dCQUNoRSxjQUFjLEVBQUUsZUFBZSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksU0FBUzthQUM5RTtZQUNELFFBQVEsRUFBRTtnQkFDUixPQUFPLEVBQUUsS0FBSzthQUNmO1lBQ0QsU0FBUyxFQUFFO2dCQUNULE9BQU8sRUFBRSxJQUFJO2dCQUNiLGlCQUFpQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO2FBQzlDO1lBQ0QsYUFBYSxFQUFFO2dCQUNiLE9BQU8sRUFBRSxLQUFLO2FBQ2Y7U0FDRixDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQW1DO1lBQzlDLFlBQVk7WUFDWixXQUFXLEVBQUUsU0FBUztZQUN0QixtQkFBbUIsRUFBRSxPQUFPO1lBQzVCLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FBQztRQUVGLE1BQU0sZUFBZSxHQUFHLCtCQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pELE1BQU0sRUFBQyxTQUFTLEVBQUMsR0FBRyx5QkFBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUV4RSxtREFBbUQ7UUFDbkQsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFsRUQsMEJBa0VDO0lBRUQsY0FBYztJQUNkLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsSUFBSSxLQUFLLEVBQUU7WUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDOztTQUVULE9BQU8sQ0FBQyxHQUFHLEVBQUU7O01BRWhCLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztHQUM5QixDQUFDLENBQUM7U0FDRjtRQUVELE1BQU0sQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0UsT0FBTyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFFIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLyA8cmVmZXJlbmNlIHR5cGVzPVwibm9kZVwiLz5cbi8vLyA8cmVmZXJlbmNlIGxpYj1cImVzMjAxN1wiLz5cblxuLy8gYHRzYy13cmFwcGVkYCBoZWxwZXJzIGFyZSBub3QgZXhwb3NlZCBpbiB0aGUgcHJpbWFyeSBgQGJhemVsL2NvbmNhdGpzYCBlbnRyeS1wb2ludC5cbi8vIFRPRE86IFVwZGF0ZSB3aGVuIGh0dHBzOi8vZ2l0aHViLmNvbS9iYXplbGJ1aWxkL3J1bGVzX25vZGVqcy9wdWxsLzMyODYgaXMgYXZhaWxhYmxlLlxuaW1wb3J0IHtmb3JtYXQsIHBhcnNlVHNjb25maWd9IGZyb20gJ0BiYXplbC9jb25jYXRqcy9pbnRlcm5hbC90c2Nfd3JhcHBlZCc7XG5pbXBvcnQge0V4dHJhY3RvciwgRXh0cmFjdG9yQ29uZmlnLCBJQ29uZmlnRmlsZSwgSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zLCBJRXh0cmFjdG9ySW52b2tlT3B0aW9uc30gZnJvbSAnQG1pY3Jvc29mdC9hcGktZXh0cmFjdG9yJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5NYWluKFxuICAgIHRzQ29uZmlnOiBzdHJpbmcsIGVudHJ5UG9pbnRFeGVjUGF0aDogc3RyaW5nLCBkdHNCdW5kbGVPdXQ6IHN0cmluZywgYXBpUmV2aWV3Rm9sZGVyPzogc3RyaW5nLFxuICAgIGFjY2VwdEFwaVVwZGF0ZXMgPSBmYWxzZSk6IDF8MCB7XG4gIGNvbnN0IFtwYXJzZWRDb25maWcsIGVycm9yc10gPSBwYXJzZVRzY29uZmlnKHRzQ29uZmlnKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoKSB7XG4gICAgY29uc29sZS5lcnJvcihmb3JtYXQoJycsIGVycm9ycykpO1xuXG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICBjb25zdCBwa2dKc29uID0gcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZShlbnRyeVBvaW50RXhlY1BhdGgpLCAncGFja2FnZS5qc29uJyk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwa2dKc29uKSkge1xuICAgIGZzLndyaXRlRmlsZVN5bmMocGtnSnNvbiwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgJ25hbWUnOiAnR0VORVJBVEVELUJZLUJBWkVMJyxcbiAgICAgICd2ZXJzaW9uJzogJzAuMC4wJyxcbiAgICAgICdkZXNjcmlwdGlvbic6ICdUaGlzIGlzIGEgZHVtbXkgcGFja2FnZS5qc29uIGFzIEFQSSBFeHRyYWN0b3IgYWx3YXlzIHJlcXVpcmVzIG9uZS4nLFxuICAgIH0pKTtcbiAgfVxuXG4gIGNvbnN0IHBhcnNlZFRzQ29uZmlnID0gcGFyc2VkQ29uZmlnIS5jb25maWcgYXMgYW55O1xuICBjb25zdCBjb21waWxlck9wdGlvbnMgPSBwYXJzZWRUc0NvbmZpZy5jb21waWxlck9wdGlvbnM7XG5cbiAgLy8gV2Ugb21pdCBhbGwgcGF0aCBtYXBwaW5ncyBmcm9tIHRoZSBjb21waWxhdGlvbiB0c2NvbmZpZy4gSW4gQW5ndWxhciBBUEYsIGFsbCBtb2R1bGUgaW1wb3J0c1xuICAvLyBhcmUgY29uc2lkZXJlZCBleHRlcm5hbCBhbmQgc2hvdWxkIGJlIHByZXNlcnZlZC4gaS5lLiBub3QgYnVuZGxlZCBpbnRvIHRoZSBkdHMgcm9sbHVwLlxuICBjb21waWxlck9wdGlvbnMucGF0aHMgPSBbXTtcblxuICBjb25zdCBleHRyYWN0b3JPcHRpb25zOiBJRXh0cmFjdG9ySW52b2tlT3B0aW9ucyA9IHtcbiAgICBsb2NhbEJ1aWxkOiBhY2NlcHRBcGlVcGRhdGVzLFxuICB9O1xuXG4gIGNvbnN0IGNvbmZpZ09iamVjdDogSUNvbmZpZ0ZpbGUgPSB7XG4gICAgY29tcGlsZXI6IHtcbiAgICAgIG92ZXJyaWRlVHNjb25maWc6IHBhcnNlZFRzQ29uZmlnLFxuICAgIH0sXG4gICAgcHJvamVjdEZvbGRlcjogcGF0aC5yZXNvbHZlKHBhdGguZGlybmFtZSh0c0NvbmZpZykpLFxuICAgIG1haW5FbnRyeVBvaW50RmlsZVBhdGg6IHBhdGgucmVzb2x2ZShlbnRyeVBvaW50RXhlY1BhdGgpLFxuICAgIGFwaVJlcG9ydDoge1xuICAgICAgZW5hYmxlZDogISFhcGlSZXZpZXdGb2xkZXIsXG4gICAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogcmVtb3ZlIHRoaXMgZm9sZGVyIG5hbWUgd2hlbiB0aGUgYmVsb3cgaXNzdWUgaXMgc29sdmVkIHVwc3RyZWFtXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvd2ViLWJ1aWxkLXRvb2xzL2lzc3Vlcy8xNDcwXG4gICAgICByZXBvcnRGaWxlTmFtZTogYXBpUmV2aWV3Rm9sZGVyICYmIHBhdGgucmVzb2x2ZShhcGlSZXZpZXdGb2xkZXIpIHx8ICdpbnZhbGlkJyxcbiAgICB9LFxuICAgIGRvY01vZGVsOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIGR0c1JvbGx1cDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHVudHJpbW1lZEZpbGVQYXRoOiBwYXRoLnJlc29sdmUoZHRzQnVuZGxlT3V0KSxcbiAgICB9LFxuICAgIHRzZG9jTWV0YWRhdGE6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH1cbiAgfTtcblxuICBjb25zdCBvcHRpb25zOiBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMgPSB7XG4gICAgY29uZmlnT2JqZWN0LFxuICAgIHBhY2thZ2VKc29uOiB1bmRlZmluZWQsXG4gICAgcGFja2FnZUpzb25GdWxsUGF0aDogcGtnSnNvbixcbiAgICBjb25maWdPYmplY3RGdWxsUGF0aDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IGV4dHJhY3RvckNvbmZpZyA9IEV4dHJhY3RvckNvbmZpZy5wcmVwYXJlKG9wdGlvbnMpO1xuICBjb25zdCB7c3VjY2VlZGVkfSA9IEV4dHJhY3Rvci5pbnZva2UoZXh0cmFjdG9yQ29uZmlnLCBleHRyYWN0b3JPcHRpb25zKTtcblxuICAvLyBBUEkgZXh0cmFjdG9yIGVycm9ycyBhcmUgZW1pdHRlZCBieSBpdCdzIGxvZ2dlci5cbiAgcmV0dXJuIHN1Y2NlZWRlZCA/IDAgOiAxO1xufVxuXG4vLyBFbnRyeSBwb2ludFxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGlmIChERUJVRykge1xuICAgIGNvbnNvbGUuZXJyb3IoYFxuYXBpLWV4dHJhY3RvcjogcnVubmluZyB3aXRoXG4gIGN3ZDogJHtwcm9jZXNzLmN3ZCgpfVxuICBhcmd2OlxuICAgICR7cHJvY2Vzcy5hcmd2LmpvaW4oJ1xcbiAgICAnKX1cbiAgYCk7XG4gIH1cblxuICBjb25zdCBbdHNDb25maWcsIGVudHJ5UG9pbnRFeGVjUGF0aCwgb3V0cHV0RXhlY1BhdGhdID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICBwcm9jZXNzLmV4aXRDb2RlID0gcnVuTWFpbih0c0NvbmZpZywgZW50cnlQb2ludEV4ZWNQYXRoLCBvdXRwdXRFeGVjUGF0aCk7XG59XG4iXX0=