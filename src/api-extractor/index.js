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
    const tslib_1 = require("tslib");
    /// <reference types="node"/>
    /// <reference lib="es2017"/>
    const typescript_1 = require("@bazel/typescript");
    const api_extractor_1 = require("@microsoft/api-extractor");
    const fs = (0, tslib_1.__importStar)(require("fs"));
    const path = (0, tslib_1.__importStar)(require("path"));
    const DEBUG = false;
    function runMain(tsConfig, entryPointExecPath, dtsBundleOut, apiReviewFolder, acceptApiUpdates = false) {
        const [parsedConfig, errors] = (0, typescript_1.parseTsconfig)(tsConfig);
        if (errors && errors.length) {
            console.error((0, typescript_1.format)('', errors));
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
        // API extractor doesn't always support the version of TypeScript used in the repo
        // example: at the moment it is not compatable with 3.2
        // to use the internal TypeScript we shall not create a program but rather pass a parsed tsConfig.
        const parsedTsConfig = parsedConfig.config;
        const compilerOptions = parsedTsConfig.compilerOptions;
        for (const [key, values] of Object.entries(compilerOptions.paths)) {
            if (key === '*') {
                continue;
            }
            // we shall not pass ts files as this will need to be parsed, and for example rxjs,
            // cannot be compiled with our tsconfig, as ours is more strict
            // hence amend the paths to point always to the '.d.ts' files.
            compilerOptions.paths[key] = values.map(path => {
                const pathSuffix = /(\*|index)$/.test(path) ? '.d.ts' : '/index.d.ts';
                return path + pathSuffix;
            });
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLDZCQUE2QjtJQUU3QixrREFBd0Q7SUFDeEQsNERBQTBJO0lBQzFJLG9EQUF5QjtJQUN6Qix3REFBNkI7SUFFN0IsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDO0lBRXBCLFNBQWdCLE9BQU8sQ0FDbkIsUUFBZ0IsRUFBRSxrQkFBMEIsRUFBRSxZQUFvQixFQUFFLGVBQXdCLEVBQzVGLGdCQUFnQixHQUFHLEtBQUs7UUFDMUIsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFBLDBCQUFhLEVBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkQsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLElBQUEsbUJBQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUVsQyxPQUFPLENBQUMsQ0FBQztTQUNWO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDL0UsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDM0IsRUFBRSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDdkMsTUFBTSxFQUFFLG9CQUFvQjtnQkFDNUIsU0FBUyxFQUFFLE9BQU87Z0JBQ2xCLGFBQWEsRUFBRSxvRUFBb0U7YUFDcEYsQ0FBQyxDQUFDLENBQUM7U0FDTDtRQUVELGtGQUFrRjtRQUNsRix1REFBdUQ7UUFDdkQsa0dBQWtHO1FBQ2xHLE1BQU0sY0FBYyxHQUFHLFlBQWEsQ0FBQyxNQUFhLENBQUM7UUFDbkQsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLGVBQWUsQ0FBQztRQUN2RCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBVyxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDM0UsSUFBSSxHQUFHLEtBQUssR0FBRyxFQUFFO2dCQUNmLFNBQVM7YUFDVjtZQUVELG1GQUFtRjtZQUNuRiwrREFBK0Q7WUFDL0QsOERBQThEO1lBQzlELGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDN0MsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7Z0JBRXRFLE9BQU8sSUFBSSxHQUFHLFVBQVUsQ0FBQztZQUMzQixDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsTUFBTSxnQkFBZ0IsR0FBNEI7WUFDaEQsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQWdCO1lBQ2hDLFFBQVEsRUFBRTtnQkFDUixnQkFBZ0IsRUFBRSxjQUFjO2FBQ2pDO1lBQ0QsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuRCxzQkFBc0IsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQ3hELFNBQVMsRUFBRTtnQkFDVCxPQUFPLEVBQUUsQ0FBQyxDQUFDLGVBQWU7Z0JBQzFCLHFGQUFxRjtnQkFDckYsZ0VBQWdFO2dCQUNoRSxjQUFjLEVBQUUsZUFBZSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksU0FBUzthQUM5RTtZQUNELFFBQVEsRUFBRTtnQkFDUixPQUFPLEVBQUUsS0FBSzthQUNmO1lBQ0QsU0FBUyxFQUFFO2dCQUNULE9BQU8sRUFBRSxJQUFJO2dCQUNiLGlCQUFpQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO2FBQzlDO1lBQ0QsYUFBYSxFQUFFO2dCQUNiLE9BQU8sRUFBRSxLQUFLO2FBQ2Y7U0FDRixDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQW1DO1lBQzlDLFlBQVk7WUFDWixXQUFXLEVBQUUsU0FBUztZQUN0QixtQkFBbUIsRUFBRSxPQUFPO1lBQzVCLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FBQztRQUVGLE1BQU0sZUFBZSxHQUFHLCtCQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pELE1BQU0sRUFBQyxTQUFTLEVBQUMsR0FBRyx5QkFBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUV4RSxtREFBbUQ7UUFDbkQsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUEvRUQsMEJBK0VDO0lBRUQsY0FBYztJQUNkLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDM0IsSUFBSSxLQUFLLEVBQUU7WUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDOztTQUVULE9BQU8sQ0FBQyxHQUFHLEVBQUU7O01BRWhCLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztHQUM5QixDQUFDLENBQUM7U0FDRjtRQUVELE1BQU0sQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0UsT0FBTyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLGNBQWMsQ0FBQyxDQUFDO0tBQzFFIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLyA8cmVmZXJlbmNlIHR5cGVzPVwibm9kZVwiLz5cbi8vLyA8cmVmZXJlbmNlIGxpYj1cImVzMjAxN1wiLz5cblxuaW1wb3J0IHtmb3JtYXQsIHBhcnNlVHNjb25maWd9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCB7RXh0cmFjdG9yLCBFeHRyYWN0b3JDb25maWcsIElDb25maWdGaWxlLCBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMsIElFeHRyYWN0b3JJbnZva2VPcHRpb25zfSBmcm9tICdAbWljcm9zb2Z0L2FwaS1leHRyYWN0b3InO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgREVCVUcgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk1haW4oXG4gICAgdHNDb25maWc6IHN0cmluZywgZW50cnlQb2ludEV4ZWNQYXRoOiBzdHJpbmcsIGR0c0J1bmRsZU91dDogc3RyaW5nLCBhcGlSZXZpZXdGb2xkZXI/OiBzdHJpbmcsXG4gICAgYWNjZXB0QXBpVXBkYXRlcyA9IGZhbHNlKTogMXwwIHtcbiAgY29uc3QgW3BhcnNlZENvbmZpZywgZXJyb3JzXSA9IHBhcnNlVHNjb25maWcodHNDb25maWcpO1xuICBpZiAoZXJyb3JzICYmIGVycm9ycy5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKGZvcm1hdCgnJywgZXJyb3JzKSk7XG5cbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIGNvbnN0IHBrZ0pzb24gPSBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKGVudHJ5UG9pbnRFeGVjUGF0aCksICdwYWNrYWdlLmpzb24nKTtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKHBrZ0pzb24pKSB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhwa2dKc29uLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAnbmFtZSc6ICdHRU5FUkFURUQtQlktQkFaRUwnLFxuICAgICAgJ3ZlcnNpb24nOiAnMC4wLjAnLFxuICAgICAgJ2Rlc2NyaXB0aW9uJzogJ1RoaXMgaXMgYSBkdW1teSBwYWNrYWdlLmpzb24gYXMgQVBJIEV4dHJhY3RvciBhbHdheXMgcmVxdWlyZXMgb25lLicsXG4gICAgfSkpO1xuICB9XG5cbiAgLy8gQVBJIGV4dHJhY3RvciBkb2Vzbid0IGFsd2F5cyBzdXBwb3J0IHRoZSB2ZXJzaW9uIG9mIFR5cGVTY3JpcHQgdXNlZCBpbiB0aGUgcmVwb1xuICAvLyBleGFtcGxlOiBhdCB0aGUgbW9tZW50IGl0IGlzIG5vdCBjb21wYXRhYmxlIHdpdGggMy4yXG4gIC8vIHRvIHVzZSB0aGUgaW50ZXJuYWwgVHlwZVNjcmlwdCB3ZSBzaGFsbCBub3QgY3JlYXRlIGEgcHJvZ3JhbSBidXQgcmF0aGVyIHBhc3MgYSBwYXJzZWQgdHNDb25maWcuXG4gIGNvbnN0IHBhcnNlZFRzQ29uZmlnID0gcGFyc2VkQ29uZmlnIS5jb25maWcgYXMgYW55O1xuICBjb25zdCBjb21waWxlck9wdGlvbnMgPSBwYXJzZWRUc0NvbmZpZy5jb21waWxlck9wdGlvbnM7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllczxzdHJpbmdbXT4oY29tcGlsZXJPcHRpb25zLnBhdGhzKSkge1xuICAgIGlmIChrZXkgPT09ICcqJykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gd2Ugc2hhbGwgbm90IHBhc3MgdHMgZmlsZXMgYXMgdGhpcyB3aWxsIG5lZWQgdG8gYmUgcGFyc2VkLCBhbmQgZm9yIGV4YW1wbGUgcnhqcyxcbiAgICAvLyBjYW5ub3QgYmUgY29tcGlsZWQgd2l0aCBvdXIgdHNjb25maWcsIGFzIG91cnMgaXMgbW9yZSBzdHJpY3RcbiAgICAvLyBoZW5jZSBhbWVuZCB0aGUgcGF0aHMgdG8gcG9pbnQgYWx3YXlzIHRvIHRoZSAnLmQudHMnIGZpbGVzLlxuICAgIGNvbXBpbGVyT3B0aW9ucy5wYXRoc1trZXldID0gdmFsdWVzLm1hcChwYXRoID0+IHtcbiAgICAgIGNvbnN0IHBhdGhTdWZmaXggPSAvKFxcKnxpbmRleCkkLy50ZXN0KHBhdGgpID8gJy5kLnRzJyA6ICcvaW5kZXguZC50cyc7XG5cbiAgICAgIHJldHVybiBwYXRoICsgcGF0aFN1ZmZpeDtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhY3Rvck9wdGlvbnM6IElFeHRyYWN0b3JJbnZva2VPcHRpb25zID0ge1xuICAgIGxvY2FsQnVpbGQ6IGFjY2VwdEFwaVVwZGF0ZXMsXG4gIH07XG5cbiAgY29uc3QgY29uZmlnT2JqZWN0OiBJQ29uZmlnRmlsZSA9IHtcbiAgICBjb21waWxlcjoge1xuICAgICAgb3ZlcnJpZGVUc2NvbmZpZzogcGFyc2VkVHNDb25maWcsXG4gICAgfSxcbiAgICBwcm9qZWN0Rm9sZGVyOiBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKHRzQ29uZmlnKSksXG4gICAgbWFpbkVudHJ5UG9pbnRGaWxlUGF0aDogcGF0aC5yZXNvbHZlKGVudHJ5UG9pbnRFeGVjUGF0aCksXG4gICAgYXBpUmVwb3J0OiB7XG4gICAgICBlbmFibGVkOiAhIWFwaVJldmlld0ZvbGRlcixcbiAgICAgIC8vIFRPRE8oYWxhbi1hZ2l1czQpOiByZW1vdmUgdGhpcyBmb2xkZXIgbmFtZSB3aGVuIHRoZSBiZWxvdyBpc3N1ZSBpcyBzb2x2ZWQgdXBzdHJlYW1cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC93ZWItYnVpbGQtdG9vbHMvaXNzdWVzLzE0NzBcbiAgICAgIHJlcG9ydEZpbGVOYW1lOiBhcGlSZXZpZXdGb2xkZXIgJiYgcGF0aC5yZXNvbHZlKGFwaVJldmlld0ZvbGRlcikgfHwgJ2ludmFsaWQnLFxuICAgIH0sXG4gICAgZG9jTW9kZWw6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgdW50cmltbWVkRmlsZVBhdGg6IHBhdGgucmVzb2x2ZShkdHNCdW5kbGVPdXQpLFxuICAgIH0sXG4gICAgdHNkb2NNZXRhZGF0YToge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IG9wdGlvbnM6IElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucyA9IHtcbiAgICBjb25maWdPYmplY3QsXG4gICAgcGFja2FnZUpzb246IHVuZGVmaW5lZCxcbiAgICBwYWNrYWdlSnNvbkZ1bGxQYXRoOiBwa2dKc29uLFxuICAgIGNvbmZpZ09iamVjdEZ1bGxQYXRoOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yQ29uZmlnID0gRXh0cmFjdG9yQ29uZmlnLnByZXBhcmUob3B0aW9ucyk7XG4gIGNvbnN0IHtzdWNjZWVkZWR9ID0gRXh0cmFjdG9yLmludm9rZShleHRyYWN0b3JDb25maWcsIGV4dHJhY3Rvck9wdGlvbnMpO1xuXG4gIC8vIEFQSSBleHRyYWN0b3IgZXJyb3JzIGFyZSBlbWl0dGVkIGJ5IGl0J3MgbG9nZ2VyLlxuICByZXR1cm4gc3VjY2VlZGVkID8gMCA6IDE7XG59XG5cbi8vIEVudHJ5IHBvaW50XG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgaWYgKERFQlVHKSB7XG4gICAgY29uc29sZS5lcnJvcihgXG5hcGktZXh0cmFjdG9yOiBydW5uaW5nIHdpdGhcbiAgY3dkOiAke3Byb2Nlc3MuY3dkKCl9XG4gIGFyZ3Y6XG4gICAgJHtwcm9jZXNzLmFyZ3Yuam9pbignXFxuICAgICcpfVxuICBgKTtcbiAgfVxuXG4gIGNvbnN0IFt0c0NvbmZpZywgZW50cnlQb2ludEV4ZWNQYXRoLCBvdXRwdXRFeGVjUGF0aF0gPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gIHByb2Nlc3MuZXhpdENvZGUgPSBydW5NYWluKHRzQ29uZmlnLCBlbnRyeVBvaW50RXhlY1BhdGgsIG91dHB1dEV4ZWNQYXRoKTtcbn1cbiJdfQ==