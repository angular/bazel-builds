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
        define("angular/packages/bazel/src/types_bundle/index", ["require", "exports", "tslib", "@microsoft/api-extractor", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runMain = void 0;
    const tslib_1 = require("tslib");
    /// <reference types="node"/>
    /// <reference lib="es2020"/>
    const api_extractor_1 = require("@microsoft/api-extractor");
    const fs = tslib_1.__importStar(require("fs"));
    const path = tslib_1.__importStar(require("path"));
    /**
     * Bundles the specified entry-point and writes the output `d.ts` bundle to the specified
     * output path. An optional license banner can be provided to be added to the bundle output.
     */
    function runMain({ entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const configObject = {
                compiler: {
                    overrideTsconfig: 
                    // We disable automatic `@types` resolution as this throws-off API reports
                    // when the API test is run outside sandbox. Instead we expect a list of
                    // hard-coded types that should be included. This works in non-sandbox too.
                    { files: [entryPointExecpath], compilerOptions: { types: [], lib: ['es2020', 'dom'] } },
                },
                // The execroot is the working directory and it will contain all input files.
                projectFolder: process.cwd(),
                mainEntryPointFilePath: path.resolve(entryPointExecpath),
                newlineKind: 'lf',
                apiReport: { enabled: false, reportFileName: 'invalid' },
                docModel: { enabled: false },
                tsdocMetadata: { enabled: false },
                dtsRollup: {
                    enabled: true,
                    untrimmedFilePath: path.resolve(outputExecpath),
                },
            };
            // Resolve to an absolute path from the current working directory (i.e. execroot).
            const packageJsonFullPath = path.resolve(packageJsonExecpath);
            const options = {
                configObject,
                packageJsonFullPath,
                packageJson: undefined,
                configObjectFullPath: undefined,
            };
            const extractorConfig = api_extractor_1.ExtractorConfig.prepare(options);
            const { succeeded } = api_extractor_1.Extractor.invoke(extractorConfig);
            if (!succeeded) {
                throw new Error('Type bundling failed. See error above.');
            }
            let bundleOutput = fs.readFileSync(outputExecpath, 'utf8');
            // Strip AMD module directive comments.
            bundleOutput = stripAmdModuleDirectiveComments(bundleOutput);
            // Remove license comments as these are not deduped in API-extractor.
            bundleOutput = bundleOutput.replace(/(\/\*\*\s+\*\s\@license(((?!\*\/).|\s)*)\*\/)/gm, '');
            // Add license banner if provided.
            if (licenseBannerExecpath) {
                bundleOutput = `${fs.readFileSync(licenseBannerExecpath, 'utf8')}\n\n` + bundleOutput;
            }
            // Re-write the output file.
            fs.writeFileSync(outputExecpath, bundleOutput);
        });
    }
    exports.runMain = runMain;
    /**
     * Strip the named AMD module for compatibility from Bazel-generated type
     * definitions. These may end up in the generated type bundles.
     *
     * e.g. `/// <amd-module name="@angular/localize/init" />` should be stripped.
    
     */
    function stripAmdModuleDirectiveComments(content) {
        return content.replace(/^\/\/\/ <amd-module name=.*\/>[\r\n]+/gm, '');
    }
    // Entry point
    const [entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath] = process.argv.slice(2);
    runMain({ entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath })
        .catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvdHlwZXNfYnVuZGxlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw2QkFBNkI7SUFDN0IsNkJBQTZCO0lBRTdCLDREQUFrSDtJQUNsSCwrQ0FBeUI7SUFDekIsbURBQTZCO0lBRTdCOzs7T0FHRztJQUNILFNBQXNCLE9BQU8sQ0FDekIsRUFBQyxrQkFBa0IsRUFBRSxjQUFjLEVBQUUsbUJBQW1CLEVBQUUscUJBQXFCLEVBSzlFOztZQUNILE1BQU0sWUFBWSxHQUFnQjtnQkFDaEMsUUFBUSxFQUFFO29CQUNSLGdCQUFnQjtvQkFDWiwwRUFBMEU7b0JBQzFFLHdFQUF3RTtvQkFDeEUsMkVBQTJFO29CQUMzRSxFQUFDLEtBQUssRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsZUFBZSxFQUFFLEVBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLEVBQUMsRUFBQztpQkFDeEY7Z0JBQ0QsNkVBQTZFO2dCQUM3RSxhQUFhLEVBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRTtnQkFDNUIsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQztnQkFDeEQsV0FBVyxFQUFFLElBQUk7Z0JBQ2pCLFNBQVMsRUFBRSxFQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBQztnQkFDdEQsUUFBUSxFQUFFLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBQztnQkFDMUIsYUFBYSxFQUFFLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBQztnQkFDL0IsU0FBUyxFQUFFO29CQUNULE9BQU8sRUFBRSxJQUFJO29CQUNiLGlCQUFpQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO2lCQUNoRDthQUNGLENBQUM7WUFFRixrRkFBa0Y7WUFDbEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDOUQsTUFBTSxPQUFPLEdBQW1DO2dCQUM5QyxZQUFZO2dCQUNaLG1CQUFtQjtnQkFDbkIsV0FBVyxFQUFFLFNBQVM7Z0JBQ3RCLG9CQUFvQixFQUFFLFNBQVM7YUFDaEMsQ0FBQztZQUVGLE1BQU0sZUFBZSxHQUFHLCtCQUFlLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pELE1BQU0sRUFBQyxTQUFTLEVBQUMsR0FBRyx5QkFBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUV0RCxJQUFJLENBQUMsU0FBUyxFQUFFO2dCQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQzthQUMzRDtZQUVELElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRTNELHVDQUF1QztZQUN2QyxZQUFZLEdBQUcsK0JBQStCLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFN0QscUVBQXFFO1lBQ3JFLFlBQVksR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLGlEQUFpRCxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRTNGLGtDQUFrQztZQUNsQyxJQUFJLHFCQUFxQixFQUFFO2dCQUN6QixZQUFZLEdBQUcsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO2FBQ3ZGO1lBRUQsNEJBQTRCO1lBQzVCLEVBQUUsQ0FBQyxhQUFhLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2pELENBQUM7S0FBQTtJQTNERCwwQkEyREM7SUFFRDs7Ozs7O09BTUc7SUFDSCxTQUFTLCtCQUErQixDQUFDLE9BQWU7UUFDdEQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLHlDQUF5QyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFRCxjQUFjO0lBQ2QsTUFBTSxDQUFDLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxtQkFBbUIsRUFBRSxxQkFBcUIsQ0FBQyxHQUNsRixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUxQixPQUFPLENBQUMsRUFBQyxrQkFBa0IsRUFBRSxjQUFjLEVBQUUsbUJBQW1CLEVBQUUscUJBQXFCLEVBQUMsQ0FBQztTQUNwRixLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLyA8cmVmZXJlbmNlIHR5cGVzPVwibm9kZVwiLz5cbi8vLyA8cmVmZXJlbmNlIGxpYj1cImVzMjAyMFwiLz5cblxuaW1wb3J0IHtFeHRyYWN0b3IsIEV4dHJhY3RvckNvbmZpZywgSUNvbmZpZ0ZpbGUsIElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucyx9IGZyb20gJ0BtaWNyb3NvZnQvYXBpLWV4dHJhY3Rvcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIEJ1bmRsZXMgdGhlIHNwZWNpZmllZCBlbnRyeS1wb2ludCBhbmQgd3JpdGVzIHRoZSBvdXRwdXQgYGQudHNgIGJ1bmRsZSB0byB0aGUgc3BlY2lmaWVkXG4gKiBvdXRwdXQgcGF0aC4gQW4gb3B0aW9uYWwgbGljZW5zZSBiYW5uZXIgY2FuIGJlIHByb3ZpZGVkIHRvIGJlIGFkZGVkIHRvIHRoZSBidW5kbGUgb3V0cHV0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuTWFpbihcbiAgICB7ZW50cnlQb2ludEV4ZWNwYXRoLCBvdXRwdXRFeGVjcGF0aCwgcGFja2FnZUpzb25FeGVjcGF0aCwgbGljZW5zZUJhbm5lckV4ZWNwYXRofToge1xuICAgICAgZW50cnlQb2ludEV4ZWNwYXRoOiBzdHJpbmcsXG4gICAgICBvdXRwdXRFeGVjcGF0aDogc3RyaW5nLFxuICAgICAgcGFja2FnZUpzb25FeGVjcGF0aDogc3RyaW5nLFxuICAgICAgbGljZW5zZUJhbm5lckV4ZWNwYXRoOiBzdHJpbmd8dW5kZWZpbmVkXG4gICAgfSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjb25maWdPYmplY3Q6IElDb25maWdGaWxlID0ge1xuICAgIGNvbXBpbGVyOiB7XG4gICAgICBvdmVycmlkZVRzY29uZmlnOlxuICAgICAgICAgIC8vIFdlIGRpc2FibGUgYXV0b21hdGljIGBAdHlwZXNgIHJlc29sdXRpb24gYXMgdGhpcyB0aHJvd3Mtb2ZmIEFQSSByZXBvcnRzXG4gICAgICAgICAgLy8gd2hlbiB0aGUgQVBJIHRlc3QgaXMgcnVuIG91dHNpZGUgc2FuZGJveC4gSW5zdGVhZCB3ZSBleHBlY3QgYSBsaXN0IG9mXG4gICAgICAgICAgLy8gaGFyZC1jb2RlZCB0eXBlcyB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZC4gVGhpcyB3b3JrcyBpbiBub24tc2FuZGJveCB0b28uXG4gICAgICAgICAge2ZpbGVzOiBbZW50cnlQb2ludEV4ZWNwYXRoXSwgY29tcGlsZXJPcHRpb25zOiB7dHlwZXM6IFtdLCBsaWI6IFsnZXMyMDIwJywgJ2RvbSddfX0sXG4gICAgfSxcbiAgICAvLyBUaGUgZXhlY3Jvb3QgaXMgdGhlIHdvcmtpbmcgZGlyZWN0b3J5IGFuZCBpdCB3aWxsIGNvbnRhaW4gYWxsIGlucHV0IGZpbGVzLlxuICAgIHByb2plY3RGb2xkZXI6IHByb2Nlc3MuY3dkKCksXG4gICAgbWFpbkVudHJ5UG9pbnRGaWxlUGF0aDogcGF0aC5yZXNvbHZlKGVudHJ5UG9pbnRFeGVjcGF0aCksXG4gICAgbmV3bGluZUtpbmQ6ICdsZicsXG4gICAgYXBpUmVwb3J0OiB7ZW5hYmxlZDogZmFsc2UsIHJlcG9ydEZpbGVOYW1lOiAnaW52YWxpZCd9LFxuICAgIGRvY01vZGVsOiB7ZW5hYmxlZDogZmFsc2V9LFxuICAgIHRzZG9jTWV0YWRhdGE6IHtlbmFibGVkOiBmYWxzZX0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgdW50cmltbWVkRmlsZVBhdGg6IHBhdGgucmVzb2x2ZShvdXRwdXRFeGVjcGF0aCksXG4gICAgfSxcbiAgfTtcblxuICAvLyBSZXNvbHZlIHRvIGFuIGFic29sdXRlIHBhdGggZnJvbSB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeSAoaS5lLiBleGVjcm9vdCkuXG4gIGNvbnN0IHBhY2thZ2VKc29uRnVsbFBhdGggPSBwYXRoLnJlc29sdmUocGFja2FnZUpzb25FeGVjcGF0aCk7XG4gIGNvbnN0IG9wdGlvbnM6IElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucyA9IHtcbiAgICBjb25maWdPYmplY3QsXG4gICAgcGFja2FnZUpzb25GdWxsUGF0aCxcbiAgICBwYWNrYWdlSnNvbjogdW5kZWZpbmVkLFxuICAgIGNvbmZpZ09iamVjdEZ1bGxQYXRoOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yQ29uZmlnID0gRXh0cmFjdG9yQ29uZmlnLnByZXBhcmUob3B0aW9ucyk7XG4gIGNvbnN0IHtzdWNjZWVkZWR9ID0gRXh0cmFjdG9yLmludm9rZShleHRyYWN0b3JDb25maWcpO1xuXG4gIGlmICghc3VjY2VlZGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUeXBlIGJ1bmRsaW5nIGZhaWxlZC4gU2VlIGVycm9yIGFib3ZlLicpO1xuICB9XG5cbiAgbGV0IGJ1bmRsZU91dHB1dCA9IGZzLnJlYWRGaWxlU3luYyhvdXRwdXRFeGVjcGF0aCwgJ3V0ZjgnKTtcblxuICAvLyBTdHJpcCBBTUQgbW9kdWxlIGRpcmVjdGl2ZSBjb21tZW50cy5cbiAgYnVuZGxlT3V0cHV0ID0gc3RyaXBBbWRNb2R1bGVEaXJlY3RpdmVDb21tZW50cyhidW5kbGVPdXRwdXQpO1xuXG4gIC8vIFJlbW92ZSBsaWNlbnNlIGNvbW1lbnRzIGFzIHRoZXNlIGFyZSBub3QgZGVkdXBlZCBpbiBBUEktZXh0cmFjdG9yLlxuICBidW5kbGVPdXRwdXQgPSBidW5kbGVPdXRwdXQucmVwbGFjZSgvKFxcL1xcKlxcKlxccytcXCpcXHNcXEBsaWNlbnNlKCgoPyFcXCpcXC8pLnxcXHMpKilcXCpcXC8pL2dtLCAnJyk7XG5cbiAgLy8gQWRkIGxpY2Vuc2UgYmFubmVyIGlmIHByb3ZpZGVkLlxuICBpZiAobGljZW5zZUJhbm5lckV4ZWNwYXRoKSB7XG4gICAgYnVuZGxlT3V0cHV0ID0gYCR7ZnMucmVhZEZpbGVTeW5jKGxpY2Vuc2VCYW5uZXJFeGVjcGF0aCwgJ3V0ZjgnKX1cXG5cXG5gICsgYnVuZGxlT3V0cHV0O1xuICB9XG5cbiAgLy8gUmUtd3JpdGUgdGhlIG91dHB1dCBmaWxlLlxuICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dEV4ZWNwYXRoLCBidW5kbGVPdXRwdXQpO1xufVxuXG4vKipcbiAqIFN0cmlwIHRoZSBuYW1lZCBBTUQgbW9kdWxlIGZvciBjb21wYXRpYmlsaXR5IGZyb20gQmF6ZWwtZ2VuZXJhdGVkIHR5cGVcbiAqIGRlZmluaXRpb25zLiBUaGVzZSBtYXkgZW5kIHVwIGluIHRoZSBnZW5lcmF0ZWQgdHlwZSBidW5kbGVzLlxuICpcbiAqIGUuZy4gYC8vLyA8YW1kLW1vZHVsZSBuYW1lPVwiQGFuZ3VsYXIvbG9jYWxpemUvaW5pdFwiIC8+YCBzaG91bGQgYmUgc3RyaXBwZWQuXG5cbiAqL1xuZnVuY3Rpb24gc3RyaXBBbWRNb2R1bGVEaXJlY3RpdmVDb21tZW50cyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gY29udGVudC5yZXBsYWNlKC9eXFwvXFwvXFwvIDxhbWQtbW9kdWxlIG5hbWU9LipcXC8+W1xcclxcbl0rL2dtLCAnJyk7XG59XG5cbi8vIEVudHJ5IHBvaW50XG5jb25zdCBbZW50cnlQb2ludEV4ZWNwYXRoLCBvdXRwdXRFeGVjcGF0aCwgcGFja2FnZUpzb25FeGVjcGF0aCwgbGljZW5zZUJhbm5lckV4ZWNwYXRoXSA9XG4gICAgcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuXG5ydW5NYWluKHtlbnRyeVBvaW50RXhlY3BhdGgsIG91dHB1dEV4ZWNwYXRoLCBwYWNrYWdlSnNvbkV4ZWNwYXRoLCBsaWNlbnNlQmFubmVyRXhlY3BhdGh9KVxuICAgIC5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICBwcm9jZXNzLmV4aXRDb2RlID0gMTtcbiAgICB9KTtcbiJdfQ==