/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvdHlwZXNfYnVuZGxlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILDZCQUE2QjtBQUM3Qiw2QkFBNkI7QUFFN0IsT0FBTyxFQUFDLFdBQVcsRUFBRSxhQUFhLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDekQsT0FBTyxFQUNMLFNBQVMsRUFDVCxlQUFlLEdBSWhCLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFFN0I7OztHQUdHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSxPQUFPLENBQUMsRUFDNUIsa0JBQWtCLEVBQ2xCLGNBQWMsRUFDZCxtQkFBbUIsRUFDbkIscUJBQXFCLEdBTXRCO0lBQ0MsTUFBTSxZQUFZLEdBQWdCO1FBQ2hDLFFBQVEsRUFBRTtZQUNSLGdCQUFnQjtZQUNkLDBFQUEwRTtZQUMxRSx3RUFBd0U7WUFDeEUsMkVBQTJFO1lBQzNFLEVBQUMsS0FBSyxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRSxlQUFlLEVBQUUsRUFBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsRUFBQyxFQUFDO1NBQ3RGO1FBQ0QsNkVBQTZFO1FBQzdFLGFBQWEsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQzVCLHNCQUFzQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUM7UUFDeEQsV0FBVyxFQUFFLElBQUk7UUFDakIsU0FBUyxFQUFFLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFDO1FBQ3RELFFBQVEsRUFBRSxFQUFDLE9BQU8sRUFBRSxLQUFLLEVB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S0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTFDLElBQUksV0FBVyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7SUFDN0IsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzdCLENBQUM7S0FBTSxDQUFDO0lBQ04scUVBQXFFO0lBQ3JFLG9FQUFvRTtJQUNwRSxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUUzRCxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7UUFDakMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDdkIsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm5vZGVcIi8+XG4vLy8gPHJlZmVyZW5jZSBsaWI9XCJlczIwMjBcIi8+XG5cbmltcG9ydCB7cnVuQXNXb3JrZXIsIHJ1bldvcmtlckxvb3B9IGZyb20gJ0BiYXplbC93b3JrZXInO1xuaW1wb3J0IHtcbiAgRXh0cmFjdG9yLFxuICBFeHRyYWN0b3JDb25maWcsXG4gIEV4dHJhY3Rvck1lc3NhZ2UsXG4gIElDb25maWdGaWxlLFxuICBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMsXG59IGZyb20gJ0BtaWNyb3NvZnQvYXBpLWV4dHJhY3Rvcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIEJ1bmRsZXMgdGhlIHNwZWNpZmllZCBlbnRyeS1wb2ludCBhbmQgd3JpdGVzIHRoZSBvdXRwdXQgYGQudHNgIGJ1bmRsZSB0byB0aGUgc3BlY2lmaWVkXG4gKiBvdXRwdXQgcGF0aC4gQW4gb3B0aW9uYWwgbGljZW5zZSBiYW5uZXIgY2FuIGJlIHByb3ZpZGVkIHRvIGJlIGFkZGVkIHRvIHRoZSBidW5kbGUgb3V0cHV0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuTWFpbih7XG4gIGVudHJ5UG9pbnRFeGVjcGF0aCxcbiAgb3V0cHV0RXhlY3BhdGgsXG4gIHBhY2thZ2VKc29uRXhlY3BhdGgsXG4gIGxpY2Vuc2VCYW5uZXJFeGVjcGF0aCxcbn06IHtcbiAgZW50cnlQb2ludEV4ZWNwYXRoOiBzdHJpbmc7XG4gIG91dHB1dEV4ZWNwYXRoOiBzdHJpbmc7XG4gIHBhY2thZ2VKc29uRXhlY3BhdGg6IHN0cmluZztcbiAgbGljZW5zZUJhbm5lckV4ZWNwYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNvbmZpZ09iamVjdDogSUNvbmZpZ0ZpbGUgPSB7XG4gICAgY29tcGlsZXI6IHtcbiAgICAgIG92ZXJyaWRlVHNjb25maWc6XG4gICAgICAgIC8vIFdlIGRpc2FibGUgYXV0b21hdGljIGBAdHlwZXNgIHJlc29sdXRpb24gYXMgdGhpcyB0aHJvd3Mtb2ZmIEFQSSByZXBvcnRzXG4gICAgICAgIC8vIHdoZW4gdGhlIEFQSSB0ZXN0IGlzIHJ1biBvdXRzaWRlIHNhbmRib3guIEluc3RlYWQgd2UgZXhwZWN0IGEgbGlzdCBvZlxuICAgICAgICAvLyBoYXJkLWNvZGVkIHR5cGVzIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkLiBUaGlzIHdvcmtzIGluIG5vbi1zYW5kYm94IHRvby5cbiAgICAgICAge2ZpbGVzOiBbZW50cnlQb2ludEV4ZWNwYXRoXSwgY29tcGlsZXJPcHRpb25zOiB7dHlwZXM6IFtdLCBsaWI6IFsnZXMyMDIwJywgJ2RvbSddfX0sXG4gICAgfSxcbiAgICAvLyBUaGUgZXhlY3Jvb3QgaXMgdGhlIHdvcmtpbmcgZGlyZWN0b3J5IGFuZCBpdCB3aWxsIGNvbnRhaW4gYWxsIGlucHV0IGZpbGVzLlxuICAgIHByb2plY3RGb2xkZXI6IHByb2Nlc3MuY3dkKCksXG4gICAgbWFpbkVudHJ5UG9pbnRGaWxlUGF0aDogcGF0aC5yZXNvbHZlKGVudHJ5UG9pbnRFeGVjcGF0aCksXG4gICAgbmV3bGluZUtpbmQ6ICdsZicsXG4gICAgYXBpUmVwb3J0OiB7ZW5hYmxlZDogZmFsc2UsIHJlcG9ydEZpbGVOYW1lOiAnaW52YWxpZCd9LFxuICAgIGRvY01vZGVsOiB7ZW5hYmxlZDogZmFsc2V9LFxuICAgIHRzZG9jTWV0YWRhdGE6IHtlbmFibGVkOiBmYWxzZX0sXG4gICAgZHRzUm9sbHVwOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgdW50cmltbWVkRmlsZVBhdGg6IHBhdGgucmVzb2x2ZShvdXRwdXRFeGVjcGF0aCksXG4gICAgfSxcbiAgfTtcblxuICAvLyBSZXNvbHZlIHRvIGFuIGFic29sdXRlIHBhdGggZnJvbSB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeSAoaS5lLiBleGVjcm9vdCkuXG4gIGNvbnN0IHBhY2thZ2VKc29uRnVsbFBhdGggPSBwYXRoLnJlc29sdmUocGFja2FnZUpzb25FeGVjcGF0aCk7XG4gIGNvbnN0IG9wdGlvbnM6IElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucyA9IHtcbiAgICBjb25maWdPYmplY3QsXG4gICAgcGFja2FnZUpzb25GdWxsUGF0aCxcbiAgICBwYWNrYWdlSnNvbjogdW5kZWZpbmVkLFxuICAgIGNvbmZpZ09iamVjdEZ1bGxQYXRoOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yQ29uZmlnID0gRXh0cmFjdG9yQ29uZmlnLnByZXBhcmUob3B0aW9ucyk7XG4gIGNvbnN0IHtzdWNjZWVkZWR9ID0gRXh0cmFjdG9yLmludm9rZShleHRyYWN0b3JDb25maWcsIHtcbiAgICBtZXNzYWdlQ2FsbGJhY2s6IGhhbmRsZUFwaUV4dHJhY3Rvck1lc3NhZ2UsXG4gIH0pO1xuXG4gIGlmICghc3VjY2VlZGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUeXBlIGJ1bmRsaW5nIGZhaWxlZC4gU2VlIGVycm9yIGFib3ZlLicpO1xuICB9XG5cbiAgbGV0IGJ1bmRsZU91dHB1dCA9IGZzLnJlYWRGaWxlU3luYyhvdXRwdXRFeGVjcGF0aCwgJ3V0ZjgnKTtcblxuICAvLyBTdHJpcCBBTUQgbW9kdWxlIGRpcmVjdGl2ZSBjb21tZW50cy5cbiAgYnVuZGxlT3V0cHV0ID0gc3RyaXBBbWRNb2R1bGVEaXJlY3RpdmVDb21tZW50cyhidW5kbGVPdXRwdXQpO1xuXG4gIC8vIFJlbW92ZSBsaWNlbnNlIGNvbW1lbnRzIGFzIHRoZXNlIGFyZSBub3QgZGVkdXBlZCBpbiBBUEktZXh0cmFjdG9yLlxuICBidW5kbGVPdXRwdXQgPSBidW5kbGVPdXRwdXQucmVwbGFjZSgvKFxcL1xcKlxcKlxccytcXCpcXHNcXEBsaWNlbnNlKCgoPyFcXCpcXC8pLnxcXHMpKilcXCpcXC8pL2dtLCAnJyk7XG5cbiAgLy8gQWRkIGxpY2Vuc2UgYmFubmVyIGlmIHByb3ZpZGVkLlxuICBpZiAobGljZW5zZUJhbm5lckV4ZWNwYXRoKSB7XG4gICAgYnVuZGxlT3V0cHV0ID0gYCR7ZnMucmVhZEZpbGVTeW5jKGxpY2Vuc2VCYW5uZXJFeGVjcGF0aCwgJ3V0ZjgnKX1cXG5cXG5gICsgYnVuZGxlT3V0cHV0O1xuICB9XG5cbiAgLy8gUmUtd3JpdGUgdGhlIG91dHB1dCBmaWxlLlxuICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dEV4ZWNwYXRoLCBidW5kbGVPdXRwdXQpO1xufVxuXG4vKipcbiAqIFN0cmlwIHRoZSBuYW1lZCBBTUQgbW9kdWxlIGZvciBjb21wYXRpYmlsaXR5IGZyb20gQmF6ZWwtZ2VuZXJhdGVkIHR5cGVcbiAqIGRlZmluaXRpb25zLiBUaGVzZSBtYXkgZW5kIHVwIGluIHRoZSBnZW5lcmF0ZWQgdHlwZSBidW5kbGVzLlxuICpcbiAqIGUuZy4gYC8vLyA8YW1kLW1vZHVsZSBuYW1lPVwiQGFuZ3VsYXIvbG9jYWxpemUvaW5pdFwiIC8+YCBzaG91bGQgYmUgc3RyaXBwZWQuXG5cbiAqL1xuZnVuY3Rpb24gc3RyaXBBbWRNb2R1bGVEaXJlY3RpdmVDb21tZW50cyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gY29udGVudC5yZXBsYWNlKC9eXFwvXFwvXFwvIDxhbWQtbW9kdWxlIG5hbWU9LipcXC8+W1xcclxcbl0rL2dtLCAnJyk7XG59XG5cbi8qKlxuICogSGFuZGxlcyBsb2dnaW5nIG1lc3NhZ2VzIGZyb20gQVBJIGV4dHJhY3Rvci5cbiAqXG4gKiBDZXJ0YWluIGluZm8gbWVzc2FnZXMgc2hvdWxkIGJlIG9taXR0ZWQgYW5kIG90aGVyIG1lc3NhZ2VzIHNob3VsZCBiZSBwcmludGVkXG4gKiB0byBzdGRlcnIgdG8gYXZvaWQgd29ya2VyIHByb3RvY29sIGNvbmZsaWN0cy5cbiAqL1xuZnVuY3Rpb24gaGFuZGxlQXBpRXh0cmFjdG9yTWVzc2FnZShtc2c6IEV4dHJhY3Rvck1lc3NhZ2UpOiB2b2lkIHtcbiAgbXNnLmhhbmRsZWQgPSB0cnVlO1xuXG4gIGlmIChtc2cubWVzc2FnZUlkID09PSAnY29uc29sZS1jb21waWxlci12ZXJzaW9uLW5vdGljZScgfHwgbXNnLm1lc3NhZ2VJZCA9PT0gJ2NvbnNvbGUtcHJlYW1ibGUnKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKG1zZy5sb2dMZXZlbCAhPT0gJ3ZlcmJvc2UnICYmIG1zZy5sb2dMZXZlbCAhPT0gJ25vbmUnKSB7XG4gICAgY29uc29sZS5lcnJvcihtc2cudGV4dCk7XG4gIH1cbn1cblxuLyoqIFJ1bnMgb25lIGJ1aWxkIHVzaW5nIHRoZSBzcGVjaWZpZWQgYnVpbGQgYWN0aW9uIGNvbW1hbmQgbGluZSBhcmd1bWVudHMuICovXG5hc3luYyBmdW5jdGlvbiBydW5PbmVCdWlsZChhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCBbZW50cnlQb2ludEV4ZWNwYXRoLCBvdXRwdXRFeGVjcGF0aCwgcGFja2FnZUpzb25FeGVjcGF0aCwgbGljZW5zZUJhbm5lckV4ZWNwYXRoXSA9IGFyZ3M7XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBydW5NYWluKHtlbnRyeVBvaW50RXhlY3BhdGgsIG91dHB1dEV4ZWNwYXRoLCBwYWNrYWdlSnNvbkV4ZWNwYXRoLCBsaWNlbnNlQmFubmVyRXhlY3BhdGh9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vIEVudHJ5LXBvaW50LlxuY29uc3QgcHJvY2Vzc0FyZ3MgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG5cbmlmIChydW5Bc1dvcmtlcihwcm9jZXNzQXJncykpIHtcbiAgcnVuV29ya2VyTG9vcChydW5PbmVCdWlsZCk7XG59IGVsc2Uge1xuICAvLyBJbiBub24td29ya2VyIG1vZGUgd2UgbmVlZCB0byBtYW51YWxseSByZWFkIHRoZSBmbGFnIGZpbGUgYW5kIG9taXRcbiAgLy8gdGhlIGxlYWRpbmcgYEBgIHRoYXQgaXMgYWRkZWQgYXMgcGFydCBvZiB0aGUgd29ya2VyIHJlcXVpcmVtZW50cy5cbiAgY29uc3QgZmxhZ0ZpbGUgPSBwcm9jZXNzQXJnc1swXS5zdWJzdHJpbmcoMSk7XG4gIGNvbnN0IGFyZ3MgPSBmcy5yZWFkRmlsZVN5bmMoZmxhZ0ZpbGUsICd1dGY4Jykuc3BsaXQoJ1xcbicpO1xuXG4gIHJ1bk9uZUJ1aWxkKGFyZ3MpLnRoZW4oKHN1Y2Nlc3MpID0+IHtcbiAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICAgIH1cbiAgfSk7XG59XG4iXX0=