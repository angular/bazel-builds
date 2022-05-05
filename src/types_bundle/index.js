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
        define("angular/packages/bazel/src/types_bundle/index", ["require", "exports", "tslib", "@bazel/worker", "@microsoft/api-extractor", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runMain = void 0;
    const tslib_1 = require("tslib");
    /// <reference types="node"/>
    /// <reference lib="es2020"/>
    const worker_1 = require("@bazel/worker");
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
            const { succeeded } = api_extractor_1.Extractor.invoke(extractorConfig, { messageCallback: handleApiExtractorMessage });
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
    /**
     * Handles logging messages from API extractor.
     *
     * Certain info messages should be omitted and other messages should be printed
     * to stderr to avoid worker protocol conflicts.
     */
    function handleApiExtractorMessage(msg) {
        msg.handled = true;
        if (msg.messageId === 'console-compiler-version-notice' || msg.messageId === 'console-preamble') {
            return;
        }
        if (msg.logLevel !== 'verbose' && msg.logLevel !== 'none') {
            console.error(msg.text);
        }
    }
    /** Runs one build using the specified build action command line arguments. */
    function runOneBuild(args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const [entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath] = args;
            try {
                yield runMain({ entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath });
                return true;
            }
            catch (e) {
                console.error(e);
                return false;
            }
        });
    }
    // Entry-point.
    const processArgs = process.argv.slice(2);
    if ((0, worker_1.runAsWorker)(processArgs)) {
        (0, worker_1.runWorkerLoop)(runOneBuild);
    }
    else {
        // In non-worker mode we need to manually read the flag file and omit
        // the leading `@` that is added as part of the worker requirements.
        const flagFile = processArgs[0].substring(1);
        const args = fs.readFileSync(flagFile, 'utf8').split('\n');
        runOneBuild(args).then(success => {
            if (!success) {
                process.exitCode = 1;
            }
        });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvdHlwZXNfYnVuZGxlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw2QkFBNkI7SUFDN0IsNkJBQTZCO0lBRTdCLDBDQUF5RDtJQUN6RCw0REFBbUk7SUFDbkksK0NBQXlCO0lBQ3pCLG1EQUE2QjtJQUU3Qjs7O09BR0c7SUFDSCxTQUFzQixPQUFPLENBQ3pCLEVBQUMsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLG1CQUFtQixFQUFFLHFCQUFxQixFQUs5RTs7WUFDSCxNQUFNLFlBQVksR0FBZ0I7Z0JBQ2hDLFFBQVEsRUFBRTtvQkFDUixnQkFBZ0I7b0JBQ1osMEVBQTBFO29CQUMxRSx3RUFBd0U7b0JBQ3hFLDJFQUEyRTtvQkFDM0UsRUFBQyxLQUFLLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLGVBQWUsRUFBRSxFQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFDLEVBQUM7aUJBQ3hGO2dCQUNELDZFQUE2RTtnQkFDN0UsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUU7Z0JBQzVCLHNCQUFzQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUM7Z0JBQ3hELFdBQVcsRUFBRSxJQUFJO2dCQUNqQixTQUFTLEVBQUUsRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUM7Z0JBQ3RELFFBQVEsRUFBRSxFQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUM7Z0JBQzFCLGFBQWEsRUFBRSxFQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUM7Z0JBQy9CLFNBQVMsRUFBRTtvQkFDVCxPQUFPLEVBQUUsSUFBSTtvQkFDYixpQkFBaUIsRUFBRSxJQUFJLENBQUMsT0FB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O1FBQ3BFLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTNELFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDL0IsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDWixPQUFPLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQzthQUN0QjtRQUNILENBQUMsQ0FBQyxDQUFDO0tBQ0oiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIvPlxuLy8vIDxyZWZlcmVuY2UgbGliPVwiZXMyMDIwXCIvPlxuXG5pbXBvcnQge3J1bkFzV29ya2VyLCBydW5Xb3JrZXJMb29wfSBmcm9tICdAYmF6ZWwvd29ya2VyJztcbmltcG9ydCB7RXh0cmFjdG9yLCBFeHRyYWN0b3JDb25maWcsIEV4dHJhY3Rvck1lc3NhZ2UsIElDb25maWdGaWxlLCBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnN9IGZyb20gJ0BtaWNyb3NvZnQvYXBpLWV4dHJhY3Rvcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIEJ1bmRsZXMgdGhlIHNwZWNpZmllZCBlbnRyeS1wb2ludCBhbmQgd3JpdGVzIHRoZSBvdXRwdXQgYGQudHNgIGJ1bmRsZSB0byB0aGUgc3BlY2lmaWVkXG4gKiBvdXRwdXQgcGF0aC4gQW4gb3B0aW9uYWwgbGljZW5zZSBiYW5uZXIgY2FuIGJlIHByb3ZpZGVkIHRvIGJlIGFkZGVkIHRvIHRoZSBidW5kbGUgb3V0cHV0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuTWFpbihcbiAgICB7ZW50cnlQb2ludEV4ZWNwYXRoLCBvdXRwdXRFeGVjcGF0aCwgcGFja2FnZUpzb25FeGVjcGF0aCwgbGljZW5zZUJhbm5lckV4ZWNwYXRofToge1xuICAgICAgZW50cnlQb2ludEV4ZWNwYXRoOiBzdHJpbmcsXG4gICAgICBvdXRwdXRFeGVjcGF0aDogc3RyaW5nLFxuICAgICAgcGFja2FnZUpzb25FeGVjcGF0aDogc3RyaW5nLFxuICAgICAgbGljZW5zZUJhbm5lckV4ZWNwYXRoOiBzdHJpbmd8dW5kZWZpbmVkXG4gICAgfSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjb25maWdPYmplY3Q6IElDb25maWdGaWxlID0ge1xuICAgIGNvbXBpbGVyOiB7XG4gICAgICBvdmVycmlkZVRzY29uZmlnOlxuICAgICAgICAgIC8vIFdlIGRpc2FibGUgYXV0b21hdGljIGBAdHlwZXNgIHJlc29sdXRpb24gYXMgdGhpcyB0aHJvd3Mtb2ZmIEFQSSByZXBvcnRzXG4gICAgICAgICAgLy8gd2hlbiB0aGUgQVBJIHRlc3QgaXMgcnVuIG91dHNpZGUgc2FuZGJveC4gSW5zdGVhZCB3ZSBleHBlY3QgYSBsaXN0IG9mXG4gICAgICAgICAgLy8gaGFyZC1jb2RlZCB0eXBlcyB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZC4gVGhpcyB3b3JrcyBpbiBub24tc2FuZGJveCB0b28uXG4gICAgICAgICAge2ZpbGVzOiBbZW50cnlQb2ludEV4ZWNwYXRoXSwgY29tcGlsZXJPcHRpb25zOiB7dHlwZXM6IFtdLCBsaWI6IFsnZXMyMDIwJywgJ2RvbSddfX0sXG4gICAgfSxcbiAgICAvLyBUaGUgZXhlY3Jvb3QgaXMgdGhlIHdvcmtpbmcgZGlyZWN0b3J5IGFuZCBpdCB3aWxsIGNvbnRhaW4gYWxsIGlucHV0IGZpbGVzLlxuICAgIHByb2plY3RGb2xkZXI6IHByb2Nlc3MuY3dkKCksXG4gICAgbWFpbkVudHJ5UG9pbnRGaWxlUGF0aDogcGF0aC5yZXNvbHZlKGVudHJ5UG9pbnRFeGVjcGF0aCksXG4gICAgbmV3bGluZUtpbmQ6ICdsZicsXG4gICAgYXBpUmVwb3J0OiB7ZW5hYmxlZDogZmFsc2UsIHJlcG9ydEZpbGVOYW1lOiAnaW52YWxpZCd9LFxuICAgIGRvY01vZGVsOiB7ZW5hYmxlZDogZmFsc2V9LFxuICAgIHRzZG9jTWV0YWRhdGE6IHtlbmFibGVkOiBmYWxzZX0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgdW50cmltbWVkRmlsZVBhdGg6IHBhdGgucmVzb2x2ZShvdXRwdXRFeGVjcGF0aCksXG4gICAgfSxcbiAgfTtcblxuICAvLyBSZXNvbHZlIHRvIGFuIGFic29sdXRlIHBhdGggZnJvbSB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeSAoaS5lLiBleGVjcm9vdCkuXG4gIGNvbnN0IHBhY2thZ2VKc29uRnVsbFBhdGggPSBwYXRoLnJlc29sdmUocGFja2FnZUpzb25FeGVjcGF0aCk7XG4gIGNvbnN0IG9wdGlvbnM6IElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucyA9IHtcbiAgICBjb25maWdPYmplY3QsXG4gICAgcGFja2FnZUpzb25GdWxsUGF0aCxcbiAgICBwYWNrYWdlSnNvbjogdW5kZWZpbmVkLFxuICAgIGNvbmZpZ09iamVjdEZ1bGxQYXRoOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yQ29uZmlnID0gRXh0cmFjdG9yQ29uZmlnLnByZXBhcmUob3B0aW9ucyk7XG4gIGNvbnN0IHtzdWNjZWVkZWR9ID1cbiAgICAgIEV4dHJhY3Rvci5pbnZva2UoZXh0cmFjdG9yQ29uZmlnLCB7bWVzc2FnZUNhbGxiYWNrOiBoYW5kbGVBcGlFeHRyYWN0b3JNZXNzYWdlfSk7XG5cbiAgaWYgKCFzdWNjZWVkZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1R5cGUgYnVuZGxpbmcgZmFpbGVkLiBTZWUgZXJyb3IgYWJvdmUuJyk7XG4gIH1cblxuICBsZXQgYnVuZGxlT3V0cHV0ID0gZnMucmVhZEZpbGVTeW5jKG91dHB1dEV4ZWNwYXRoLCAndXRmOCcpO1xuXG4gIC8vIFN0cmlwIEFNRCBtb2R1bGUgZGlyZWN0aXZlIGNvbW1lbnRzLlxuICBidW5kbGVPdXRwdXQgPSBzdHJpcEFtZE1vZHVsZURpcmVjdGl2ZUNvbW1lbnRzKGJ1bmRsZU91dHB1dCk7XG5cbiAgLy8gUmVtb3ZlIGxpY2Vuc2UgY29tbWVudHMgYXMgdGhlc2UgYXJlIG5vdCBkZWR1cGVkIGluIEFQSS1leHRyYWN0b3IuXG4gIGJ1bmRsZU91dHB1dCA9IGJ1bmRsZU91dHB1dC5yZXBsYWNlKC8oXFwvXFwqXFwqXFxzK1xcKlxcc1xcQGxpY2Vuc2UoKCg/IVxcKlxcLykufFxccykqKVxcKlxcLykvZ20sICcnKTtcblxuICAvLyBBZGQgbGljZW5zZSBiYW5uZXIgaWYgcHJvdmlkZWQuXG4gIGlmIChsaWNlbnNlQmFubmVyRXhlY3BhdGgpIHtcbiAgICBidW5kbGVPdXRwdXQgPSBgJHtmcy5yZWFkRmlsZVN5bmMobGljZW5zZUJhbm5lckV4ZWNwYXRoLCAndXRmOCcpfVxcblxcbmAgKyBidW5kbGVPdXRwdXQ7XG4gIH1cblxuICAvLyBSZS13cml0ZSB0aGUgb3V0cHV0IGZpbGUuXG4gIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0RXhlY3BhdGgsIGJ1bmRsZU91dHB1dCk7XG59XG5cbi8qKlxuICogU3RyaXAgdGhlIG5hbWVkIEFNRCBtb2R1bGUgZm9yIGNvbXBhdGliaWxpdHkgZnJvbSBCYXplbC1nZW5lcmF0ZWQgdHlwZVxuICogZGVmaW5pdGlvbnMuIFRoZXNlIG1heSBlbmQgdXAgaW4gdGhlIGdlbmVyYXRlZCB0eXBlIGJ1bmRsZXMuXG4gKlxuICogZS5nLiBgLy8vIDxhbWQtbW9kdWxlIG5hbWU9XCJAYW5ndWxhci9sb2NhbGl6ZS9pbml0XCIgLz5gIHNob3VsZCBiZSBzdHJpcHBlZC5cblxuICovXG5mdW5jdGlvbiBzdHJpcEFtZE1vZHVsZURpcmVjdGl2ZUNvbW1lbnRzKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBjb250ZW50LnJlcGxhY2UoL15cXC9cXC9cXC8gPGFtZC1tb2R1bGUgbmFtZT0uKlxcLz5bXFxyXFxuXSsvZ20sICcnKTtcbn1cblxuLyoqXG4gKiBIYW5kbGVzIGxvZ2dpbmcgbWVzc2FnZXMgZnJvbSBBUEkgZXh0cmFjdG9yLlxuICpcbiAqIENlcnRhaW4gaW5mbyBtZXNzYWdlcyBzaG91bGQgYmUgb21pdHRlZCBhbmQgb3RoZXIgbWVzc2FnZXMgc2hvdWxkIGJlIHByaW50ZWRcbiAqIHRvIHN0ZGVyciB0byBhdm9pZCB3b3JrZXIgcHJvdG9jb2wgY29uZmxpY3RzLlxuICovXG5mdW5jdGlvbiBoYW5kbGVBcGlFeHRyYWN0b3JNZXNzYWdlKG1zZzogRXh0cmFjdG9yTWVzc2FnZSk6IHZvaWQge1xuICBtc2cuaGFuZGxlZCA9IHRydWU7XG5cbiAgaWYgKG1zZy5tZXNzYWdlSWQgPT09ICdjb25zb2xlLWNvbXBpbGVyLXZlcnNpb24tbm90aWNlJyB8fCBtc2cubWVzc2FnZUlkID09PSAnY29uc29sZS1wcmVhbWJsZScpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAobXNnLmxvZ0xldmVsICE9PSAndmVyYm9zZScgJiYgbXNnLmxvZ0xldmVsICE9PSAnbm9uZScpIHtcbiAgICBjb25zb2xlLmVycm9yKG1zZy50ZXh0KTtcbiAgfVxufVxuXG4vKiogUnVucyBvbmUgYnVpbGQgdXNpbmcgdGhlIHNwZWNpZmllZCBidWlsZCBhY3Rpb24gY29tbWFuZCBsaW5lIGFyZ3VtZW50cy4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1bk9uZUJ1aWxkKGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IFtlbnRyeVBvaW50RXhlY3BhdGgsIG91dHB1dEV4ZWNwYXRoLCBwYWNrYWdlSnNvbkV4ZWNwYXRoLCBsaWNlbnNlQmFubmVyRXhlY3BhdGhdID0gYXJncztcblxuICB0cnkge1xuICAgIGF3YWl0IHJ1bk1haW4oe2VudHJ5UG9pbnRFeGVjcGF0aCwgb3V0cHV0RXhlY3BhdGgsIHBhY2thZ2VKc29uRXhlY3BhdGgsIGxpY2Vuc2VCYW5uZXJFeGVjcGF0aH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5lcnJvcihlKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLy8gRW50cnktcG9pbnQuXG5jb25zdCBwcm9jZXNzQXJncyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcblxuaWYgKHJ1bkFzV29ya2VyKHByb2Nlc3NBcmdzKSkge1xuICBydW5Xb3JrZXJMb29wKHJ1bk9uZUJ1aWxkKTtcbn0gZWxzZSB7XG4gIC8vIEluIG5vbi13b3JrZXIgbW9kZSB3ZSBuZWVkIHRvIG1hbnVhbGx5IHJlYWQgdGhlIGZsYWcgZmlsZSBhbmQgb21pdFxuICAvLyB0aGUgbGVhZGluZyBgQGAgdGhhdCBpcyBhZGRlZCBhcyBwYXJ0IG9mIHRoZSB3b3JrZXIgcmVxdWlyZW1lbnRzLlxuICBjb25zdCBmbGFnRmlsZSA9IHByb2Nlc3NBcmdzWzBdLnN1YnN0cmluZygxKTtcbiAgY29uc3QgYXJncyA9IGZzLnJlYWRGaWxlU3luYyhmbGFnRmlsZSwgJ3V0ZjgnKS5zcGxpdCgnXFxuJyk7XG5cbiAgcnVuT25lQnVpbGQoYXJncykudGhlbihzdWNjZXNzID0+IHtcbiAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICAgIH1cbiAgfSk7XG59XG4iXX0=