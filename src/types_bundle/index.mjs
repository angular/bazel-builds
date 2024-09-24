/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
/// <reference types="node"/>
/// <reference lib="es2020"/>
import { runAsWorker, runWorkerLoop } from '@bazel/worker';
import { Extractor, ExtractorConfig, } from '@microsoft/api-extractor';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Bundles the specified entry-point and writes the output `d.ts` bundle to the specified
 * output path. An optional license banner can be provided to be added to the bundle output.
 */
export async function runMain({ entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath, }) {
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
    const extractorConfig = ExtractorConfig.prepare(options);
    const { succeeded } = Extractor.invoke(extractorConfig, {
        messageCallback: handleApiExtractorMessage,
    });
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
}
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
async function runOneBuild(args) {
    const [entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath] = args;
    try {
        await runMain({ entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath });
        return true;
    }
    catch (e) {
        console.error(e);
        return false;
    }
}
// Entry-point.
const processArgs = process.argv.slice(2);
if (runAsWorker(processArgs)) {
    runWorkerLoop(runOneBuild);
}
else {
    // In non-worker mode we need to manually read the flag file and omit
    // the leading `@` that is added as part of the worker requirements.
    const flagFile = processArgs[0].substring(1);
    const args = fs.readFileSync(flagFile, 'utf8').split('\n');
    runOneBuild(args).then((success) => {
        if (!success) {
            process.exitCode = 1;
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvdHlwZXNfYnVuZGxlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILDZCQUE2QjtBQUM3Qiw2QkFBNkI7QUFFN0IsT0FBTyxFQUFDLFdBQVcsRUFBRSxhQUFhLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDekQsT0FBTyxFQUNMLFNBQVMsRUFDVCxlQUFlLEdBSWhCLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFFN0I7OztHQUdHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSxPQUFPLENBQUMsRUFDNUIsa0JBQWtCLEVBQ2xCLGNBQWMsRUFDZCxtQkFBbUIsRUFDbkIscUJBQXFCLEdBTXRCO0lBQ0MsTUFBTSxZQUFZLEdBQWdCO1FBQ2hDLFFBQVEsRUFBRTtZQUNSLGdCQUFnQjtZQUNkLDBFQUEwRTtZQUMxRSx3RUFBd0U7WUFDeEUsMkVBQTJFO1lBQzNFLEVBQUMsS0FBSyxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRSxlQUFlLEVBQUUsRUFBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsRUFBQyxFQUFDO1NBQ3RGO1FBQ0QsNkVBQTZFO1FBQzdFLGFBQWEsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQzVCLHNCQUFzQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUM7UUFDeEQsV0FBVyxFQUFFLElBQUk7UUFDakIsU0FBUyxFQUFFLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFDO1FBQ3RELFFBQVEsRUFBRSxFQUFDLE9BQU8sRUFBRSxLQUFLLEVB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S0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTFDLElBQUksV0FBVyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7SUFDN0IsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzdCLENBQUM7S0FBTSxDQUFDO0lBQ04scUVBQXFFO0lBQ3JFLG9FQUFvRTtJQUNwRSxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUUzRCxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7UUFDakMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDdkIsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmRldi9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIvPlxuLy8vIDxyZWZlcmVuY2UgbGliPVwiZXMyMDIwXCIvPlxuXG5pbXBvcnQge3J1bkFzV29ya2VyLCBydW5Xb3JrZXJMb29wfSBmcm9tICdAYmF6ZWwvd29ya2VyJztcbmltcG9ydCB7XG4gIEV4dHJhY3RvcixcbiAgRXh0cmFjdG9yQ29uZmlnLFxuICBFeHRyYWN0b3JNZXNzYWdlLFxuICBJQ29uZmlnRmlsZSxcbiAgSUV4dHJhY3RvckNvbmZpZ1ByZXBhcmVPcHRpb25zLFxufSBmcm9tICdAbWljcm9zb2Z0L2FwaS1leHRyYWN0b3InO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyoqXG4gKiBCdW5kbGVzIHRoZSBzcGVjaWZpZWQgZW50cnktcG9pbnQgYW5kIHdyaXRlcyB0aGUgb3V0cHV0IGBkLnRzYCBidW5kbGUgdG8gdGhlIHNwZWNpZmllZFxuICogb3V0cHV0IHBhdGguIEFuIG9wdGlvbmFsIGxpY2Vuc2UgYmFubmVyIGNhbiBiZSBwcm92aWRlZCB0byBiZSBhZGRlZCB0byB0aGUgYnVuZGxlIG91dHB1dC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bk1haW4oe1xuICBlbnRyeVBvaW50RXhlY3BhdGgsXG4gIG91dHB1dEV4ZWNwYXRoLFxuICBwYWNrYWdlSnNvbkV4ZWNwYXRoLFxuICBsaWNlbnNlQmFubmVyRXhlY3BhdGgsXG59OiB7XG4gIGVudHJ5UG9pbnRFeGVjcGF0aDogc3RyaW5nO1xuICBvdXRwdXRFeGVjcGF0aDogc3RyaW5nO1xuICBwYWNrYWdlSnNvbkV4ZWNwYXRoOiBzdHJpbmc7XG4gIGxpY2Vuc2VCYW5uZXJFeGVjcGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xufSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjb25maWdPYmplY3Q6IElDb25maWdGaWxlID0ge1xuICAgIGNvbXBpbGVyOiB7XG4gICAgICBvdmVycmlkZVRzY29uZmlnOlxuICAgICAgICAvLyBXZSBkaXNhYmxlIGF1dG9tYXRpYyBgQHR5cGVzYCByZXNvbHV0aW9uIGFzIHRoaXMgdGhyb3dzLW9mZiBBUEkgcmVwb3J0c1xuICAgICAgICAvLyB3aGVuIHRoZSBBUEkgdGVzdCBpcyBydW4gb3V0c2lkZSBzYW5kYm94LiBJbnN0ZWFkIHdlIGV4cGVjdCBhIGxpc3Qgb2ZcbiAgICAgICAgLy8gaGFyZC1jb2RlZCB0eXBlcyB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZC4gVGhpcyB3b3JrcyBpbiBub24tc2FuZGJveCB0b28uXG4gICAgICAgIHtmaWxlczogW2VudHJ5UG9pbnRFeGVjcGF0aF0sIGNvbXBpbGVyT3B0aW9uczoge3R5cGVzOiBbXSwgbGliOiBbJ2VzMjAyMCcsICdkb20nXX19LFxuICAgIH0sXG4gICAgLy8gVGhlIGV4ZWNyb290IGlzIHRoZSB3b3JraW5nIGRpcmVjdG9yeSBhbmQgaXQgd2lsbCBjb250YWluIGFsbCBpbnB1dCBmaWxlcy5cbiAgICBwcm9qZWN0Rm9sZGVyOiBwcm9jZXNzLmN3ZCgpLFxuICAgIG1haW5FbnRyeVBvaW50RmlsZVBhdGg6IHBhdGgucmVzb2x2ZShlbnRyeVBvaW50RXhlY3BhdGgpLFxuICAgIG5ld2xpbmVLaW5kOiAnbGYnLFxuICAgIGFwaVJlcG9ydDoge2VuYWJsZWQ6IGZhbHNlLCByZXBvcnRGaWxlTmFtZTogJ2ludmFsaWQnfSxcbiAgICBkb2NNb2RlbDoge2VuYWJsZWQ6IGZhbHNlfSxcbiAgICB0c2RvY01ldGFkYXRhOiB7ZW5hYmxlZDogZmFsc2V9LFxuICAgIGR0c1JvbGx1cDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHVudHJpbW1lZEZpbGVQYXRoOiBwYXRoLnJlc29sdmUob3V0cHV0RXhlY3BhdGgpLFxuICAgIH0sXG4gIH07XG5cbiAgLy8gUmVzb2x2ZSB0byBhbiBhYnNvbHV0ZSBwYXRoIGZyb20gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgKGkuZS4gZXhlY3Jvb3QpLlxuICBjb25zdCBwYWNrYWdlSnNvbkZ1bGxQYXRoID0gcGF0aC5yZXNvbHZlKHBhY2thZ2VKc29uRXhlY3BhdGgpO1xuICBjb25zdCBvcHRpb25zOiBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMgPSB7XG4gICAgY29uZmlnT2JqZWN0LFxuICAgIHBhY2thZ2VKc29uRnVsbFBhdGgsXG4gICAgcGFja2FnZUpzb246IHVuZGVmaW5lZCxcbiAgICBjb25maWdPYmplY3RGdWxsUGF0aDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IGV4dHJhY3RvckNvbmZpZyA9IEV4dHJhY3RvckNvbmZpZy5wcmVwYXJlKG9wdGlvbnMpO1xuICBjb25zdCB7c3VjY2VlZGVkfSA9IEV4dHJhY3Rvci5pbnZva2UoZXh0cmFjdG9yQ29uZmlnLCB7XG4gICAgbWVzc2FnZUNhbGxiYWNrOiBoYW5kbGVBcGlFeHRyYWN0b3JNZXNzYWdlLFxuICB9KTtcblxuICBpZiAoIXN1Y2NlZWRlZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVHlwZSBidW5kbGluZyBmYWlsZWQuIFNlZSBlcnJvciBhYm92ZS4nKTtcbiAgfVxuXG4gIGxldCBidW5kbGVPdXRwdXQgPSBmcy5yZWFkRmlsZVN5bmMob3V0cHV0RXhlY3BhdGgsICd1dGY4Jyk7XG5cbiAgLy8gU3RyaXAgQU1EIG1vZHVsZSBkaXJlY3RpdmUgY29tbWVudHMuXG4gIGJ1bmRsZU91dHB1dCA9IHN0cmlwQW1kTW9kdWxlRGlyZWN0aXZlQ29tbWVudHMoYnVuZGxlT3V0cHV0KTtcblxuICAvLyBSZW1vdmUgbGljZW5zZSBjb21tZW50cyBhcyB0aGVzZSBhcmUgbm90IGRlZHVwZWQgaW4gQVBJLWV4dHJhY3Rvci5cbiAgYnVuZGxlT3V0cHV0ID0gYnVuZGxlT3V0cHV0LnJlcGxhY2UoLyhcXC9cXCpcXCpcXHMrXFwqXFxzXFxAbGljZW5zZSgoKD8hXFwqXFwvKS58XFxzKSopXFwqXFwvKS9nbSwgJycpO1xuXG4gIC8vIEFkZCBsaWNlbnNlIGJhbm5lciBpZiBwcm92aWRlZC5cbiAgaWYgKGxpY2Vuc2VCYW5uZXJFeGVjcGF0aCkge1xuICAgIGJ1bmRsZU91dHB1dCA9IGAke2ZzLnJlYWRGaWxlU3luYyhsaWNlbnNlQmFubmVyRXhlY3BhdGgsICd1dGY4Jyl9XFxuXFxuYCArIGJ1bmRsZU91dHB1dDtcbiAgfVxuXG4gIC8vIFJlLXdyaXRlIHRoZSBvdXRwdXQgZmlsZS5cbiAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRFeGVjcGF0aCwgYnVuZGxlT3V0cHV0KTtcbn1cblxuLyoqXG4gKiBTdHJpcCB0aGUgbmFtZWQgQU1EIG1vZHVsZSBmb3IgY29tcGF0aWJpbGl0eSBmcm9tIEJhemVsLWdlbmVyYXRlZCB0eXBlXG4gKiBkZWZpbml0aW9ucy4gVGhlc2UgbWF5IGVuZCB1cCBpbiB0aGUgZ2VuZXJhdGVkIHR5cGUgYnVuZGxlcy5cbiAqXG4gKiBlLmcuIGAvLy8gPGFtZC1tb2R1bGUgbmFtZT1cIkBhbmd1bGFyL2xvY2FsaXplL2luaXRcIiAvPmAgc2hvdWxkIGJlIHN0cmlwcGVkLlxuXG4gKi9cbmZ1bmN0aW9uIHN0cmlwQW1kTW9kdWxlRGlyZWN0aXZlQ29tbWVudHMoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZSgvXlxcL1xcL1xcLyA8YW1kLW1vZHVsZSBuYW1lPS4qXFwvPltcXHJcXG5dKy9nbSwgJycpO1xufVxuXG4vKipcbiAqIEhhbmRsZXMgbG9nZ2luZyBtZXNzYWdlcyBmcm9tIEFQSSBleHRyYWN0b3IuXG4gKlxuICogQ2VydGFpbiBpbmZvIG1lc3NhZ2VzIHNob3VsZCBiZSBvbWl0dGVkIGFuZCBvdGhlciBtZXNzYWdlcyBzaG91bGQgYmUgcHJpbnRlZFxuICogdG8gc3RkZXJyIHRvIGF2b2lkIHdvcmtlciBwcm90b2NvbCBjb25mbGljdHMuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUFwaUV4dHJhY3Rvck1lc3NhZ2UobXNnOiBFeHRyYWN0b3JNZXNzYWdlKTogdm9pZCB7XG4gIG1zZy5oYW5kbGVkID0gdHJ1ZTtcblxuICBpZiAobXNnLm1lc3NhZ2VJZCA9PT0gJ2NvbnNvbGUtY29tcGlsZXItdmVyc2lvbi1ub3RpY2UnIHx8IG1zZy5tZXNzYWdlSWQgPT09ICdjb25zb2xlLXByZWFtYmxlJykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChtc2cubG9nTGV2ZWwgIT09ICd2ZXJib3NlJyAmJiBtc2cubG9nTGV2ZWwgIT09ICdub25lJykge1xuICAgIGNvbnNvbGUuZXJyb3IobXNnLnRleHQpO1xuICB9XG59XG5cbi8qKiBSdW5zIG9uZSBidWlsZCB1c2luZyB0aGUgc3BlY2lmaWVkIGJ1aWxkIGFjdGlvbiBjb21tYW5kIGxpbmUgYXJndW1lbnRzLiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuT25lQnVpbGQoYXJnczogc3RyaW5nW10pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgW2VudHJ5UG9pbnRFeGVjcGF0aCwgb3V0cHV0RXhlY3BhdGgsIHBhY2thZ2VKc29uRXhlY3BhdGgsIGxpY2Vuc2VCYW5uZXJFeGVjcGF0aF0gPSBhcmdzO1xuXG4gIHRyeSB7XG4gICAgYXdhaXQgcnVuTWFpbih7ZW50cnlQb2ludEV4ZWNwYXRoLCBvdXRwdXRFeGVjcGF0aCwgcGFja2FnZUpzb25FeGVjcGF0aCwgbGljZW5zZUJhbm5lckV4ZWNwYXRofSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vLyBFbnRyeS1wb2ludC5cbmNvbnN0IHByb2Nlc3NBcmdzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuXG5pZiAocnVuQXNXb3JrZXIocHJvY2Vzc0FyZ3MpKSB7XG4gIHJ1bldvcmtlckxvb3AocnVuT25lQnVpbGQpO1xufSBlbHNlIHtcbiAgLy8gSW4gbm9uLXdvcmtlciBtb2RlIHdlIG5lZWQgdG8gbWFudWFsbHkgcmVhZCB0aGUgZmxhZyBmaWxlIGFuZCBvbWl0XG4gIC8vIHRoZSBsZWFkaW5nIGBAYCB0aGF0IGlzIGFkZGVkIGFzIHBhcnQgb2YgdGhlIHdvcmtlciByZXF1aXJlbWVudHMuXG4gIGNvbnN0IGZsYWdGaWxlID0gcHJvY2Vzc0FyZ3NbMF0uc3Vic3RyaW5nKDEpO1xuICBjb25zdCBhcmdzID0gZnMucmVhZEZpbGVTeW5jKGZsYWdGaWxlLCAndXRmOCcpLnNwbGl0KCdcXG4nKTtcblxuICBydW5PbmVCdWlsZChhcmdzKS50aGVuKChzdWNjZXNzKSA9PiB7XG4gICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICBwcm9jZXNzLmV4aXRDb2RlID0gMTtcbiAgICB9XG4gIH0pO1xufVxuIl19