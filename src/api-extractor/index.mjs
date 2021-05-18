/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node"/>
/// <reference lib="es2017"/>
import { format, parseTsconfig } from '@bazel/typescript';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import * as fs from 'fs';
import * as path from 'path';
const DEBUG = false;
export function runMain(tsConfig, entryPoint, dtsBundleOut, apiReviewFolder, acceptApiUpdates = false) {
    const [parsedConfig, errors] = parseTsconfig(tsConfig);
    if (errors && errors.length) {
        console.error(format('', errors));
        return 1;
    }
    const pkgJson = path.resolve(path.dirname(entryPoint), 'package.json');
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
    const options = {
        configObject,
        packageJson: undefined,
        packageJsonFullPath: pkgJson,
        configObjectFullPath: undefined,
    };
    const extractorConfig = ExtractorConfig.prepare(options);
    const { succeeded } = Extractor.invoke(extractorConfig, extractorOptions);
    // API extractor errors are emitted by it's logger.
    return succeeded ? 0 : 1;
}
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
    const [tsConfig, entryPoint, dtsBundleOut] = process.argv.slice(2);
    const entryPoints = entryPoint.split(',');
    const dtsBundleOuts = dtsBundleOut.split(',');
    if (entryPoints.length !== entryPoints.length) {
        throw new Error(`Entry points count (${entryPoints.length}) does not match Bundle out count (${dtsBundleOuts.length})`);
    }
    for (let i = 0; i < entryPoints.length; i++) {
        process.exitCode = runMain(tsConfig, entryPoints[i], dtsBundleOuts[i]);
        if (process.exitCode !== 0) {
            break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYXBpLWV4dHJhY3Rvci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBRTdCLE9BQU8sRUFBQyxNQUFNLEVBQUUsYUFBYSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDeEQsT0FBTyxFQUFDLFNBQVMsRUFBRSxlQUFlLEVBQXVFLE1BQU0sMEJBQTBCLENBQUM7QUFDMUksT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLElBQUksTUFBTSxNQUFNLENBQUM7QUFFN0IsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBRXBCLE1BQU0sVUFBVSxPQUFPLENBQ25CLFFBQWdCLEVBQUUsVUFBa0IsRUFBRSxZQUFxQixFQUFFLGVBQXdCLEVBQ3JGLGdCQUFnQixHQUFHLEtBQUs7SUFDMUIsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkQsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUVsQyxPQUFPLENBQUMsQ0FBQztLQUNWO0lBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3ZFLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDdkMsTUFBTSxFQUFFLG9C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TUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQyxNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTlDLElBQUksV0FBVyxDQUFDLE1BQU0sS0FBSyxXQUFXLENBQUMsTUFBTSxFQUFFO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLFdBQVcsQ0FBQyxNQUFNLHNDQUNyRCxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztLQUM5QjtJQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQzNDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdkUsSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLENBQUMsRUFBRTtZQUMxQixNQUFNO1NBQ1A7S0FDRjtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vLyA8cmVmZXJlbmNlIHR5cGVzPVwibm9kZVwiLz5cbi8vLyA8cmVmZXJlbmNlIGxpYj1cImVzMjAxN1wiLz5cblxuaW1wb3J0IHtmb3JtYXQsIHBhcnNlVHNjb25maWd9IGZyb20gJ0BiYXplbC90eXBlc2NyaXB0JztcbmltcG9ydCB7RXh0cmFjdG9yLCBFeHRyYWN0b3JDb25maWcsIElDb25maWdGaWxlLCBJRXh0cmFjdG9yQ29uZmlnUHJlcGFyZU9wdGlvbnMsIElFeHRyYWN0b3JJbnZva2VPcHRpb25zfSBmcm9tICdAbWljcm9zb2Z0L2FwaS1leHRyYWN0b3InO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgREVCVUcgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk1haW4oXG4gICAgdHNDb25maWc6IHN0cmluZywgZW50cnlQb2ludDogc3RyaW5nLCBkdHNCdW5kbGVPdXQ/OiBzdHJpbmcsIGFwaVJldmlld0ZvbGRlcj86IHN0cmluZyxcbiAgICBhY2NlcHRBcGlVcGRhdGVzID0gZmFsc2UpOiAxfDAge1xuICBjb25zdCBbcGFyc2VkQ29uZmlnLCBlcnJvcnNdID0gcGFyc2VUc2NvbmZpZyh0c0NvbmZpZyk7XG4gIGlmIChlcnJvcnMgJiYgZXJyb3JzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IoZm9ybWF0KCcnLCBlcnJvcnMpKTtcblxuICAgIHJldHVybiAxO1xuICB9XG5cbiAgY29uc3QgcGtnSnNvbiA9IHBhdGgucmVzb2x2ZShwYXRoLmRpcm5hbWUoZW50cnlQb2ludCksICdwYWNrYWdlLmpzb24nKTtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKHBrZ0pzb24pKSB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhwa2dKc29uLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAnbmFtZSc6ICdHRU5FUkFURUQtQlktQkFaRUwnLFxuICAgICAgJ3ZlcnNpb24nOiAnMC4wLjAnLFxuICAgICAgJ2Rlc2NyaXB0aW9uJzogJ1RoaXMgaXMgYSBkdW1teSBwYWNrYWdlLmpzb24gYXMgQVBJIEV4dHJhY3RvciBhbHdheXMgcmVxdWlyZXMgb25lLicsXG4gICAgfSkpO1xuICB9XG5cbiAgLy8gQVBJIGV4dHJhY3RvciBkb2Vzbid0IGFsd2F5cyBzdXBwb3J0IHRoZSB2ZXJzaW9uIG9mIFR5cGVTY3JpcHQgdXNlZCBpbiB0aGUgcmVwb1xuICAvLyBleGFtcGxlOiBhdCB0aGUgbW9tZW50IGl0IGlzIG5vdCBjb21wYXRhYmxlIHdpdGggMy4yXG4gIC8vIHRvIHVzZSB0aGUgaW50ZXJuYWwgVHlwZVNjcmlwdCB3ZSBzaGFsbCBub3QgY3JlYXRlIGEgcHJvZ3JhbSBidXQgcmF0aGVyIHBhc3MgYSBwYXJzZWQgdHNDb25maWcuXG4gIGNvbnN0IHBhcnNlZFRzQ29uZmlnID0gcGFyc2VkQ29uZmlnIS5jb25maWcgYXMgYW55O1xuICBjb25zdCBjb21waWxlck9wdGlvbnMgPSBwYXJzZWRUc0NvbmZpZy5jb21waWxlck9wdGlvbnM7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllczxzdHJpbmdbXT4oY29tcGlsZXJPcHRpb25zLnBhdGhzKSkge1xuICAgIGlmIChrZXkgPT09ICcqJykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gd2Ugc2hhbGwgbm90IHBhc3MgdHMgZmlsZXMgYXMgdGhpcyB3aWxsIG5lZWQgdG8gYmUgcGFyc2VkLCBhbmQgZm9yIGV4YW1wbGUgcnhqcyxcbiAgICAvLyBjYW5ub3QgYmUgY29tcGlsZWQgd2l0aCBvdXIgdHNjb25maWcsIGFzIG91cnMgaXMgbW9yZSBzdHJpY3RcbiAgICAvLyBoZW5jZSBhbWVuZCB0aGUgcGF0aHMgdG8gcG9pbnQgYWx3YXlzIHRvIHRoZSAnLmQudHMnIGZpbGVzLlxuICAgIGNvbXBpbGVyT3B0aW9ucy5wYXRoc1trZXldID0gdmFsdWVzLm1hcChwYXRoID0+IHtcbiAgICAgIGNvbnN0IHBhdGhTdWZmaXggPSAvKFxcKnxpbmRleCkkLy50ZXN0KHBhdGgpID8gJy5kLnRzJyA6ICcvaW5kZXguZC50cyc7XG5cbiAgICAgIHJldHVybiBwYXRoICsgcGF0aFN1ZmZpeDtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhY3Rvck9wdGlvbnM6IElFeHRyYWN0b3JJbnZva2VPcHRpb25zID0ge1xuICAgIGxvY2FsQnVpbGQ6IGFjY2VwdEFwaVVwZGF0ZXMsXG4gIH07XG5cbiAgY29uc3QgY29uZmlnT2JqZWN0OiBJQ29uZmlnRmlsZSA9IHtcbiAgICBjb21waWxlcjoge1xuICAgICAgb3ZlcnJpZGVUc2NvbmZpZzogcGFyc2VkVHNDb25maWcsXG4gICAgfSxcbiAgICBwcm9qZWN0Rm9sZGVyOiBwYXRoLnJlc29sdmUocGF0aC5kaXJuYW1lKHRzQ29uZmlnKSksXG4gICAgbWFpbkVudHJ5UG9pbnRGaWxlUGF0aDogcGF0aC5yZXNvbHZlKGVudHJ5UG9pbnQpLFxuICAgIGFwaVJlcG9ydDoge1xuICAgICAgZW5hYmxlZDogISFhcGlSZXZpZXdGb2xkZXIsXG4gICAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogcmVtb3ZlIHRoaXMgZm9sZGVyIG5hbWUgd2hlbiB0aGUgYmVsb3cgaXNzdWUgaXMgc29sdmVkIHVwc3RyZWFtXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvd2ViLWJ1aWxkLXRvb2xzL2lzc3Vlcy8xNDcwXG4gICAgICByZXBvcnRGaWxlTmFtZTogYXBpUmV2aWV3Rm9sZGVyICYmIHBhdGgucmVzb2x2ZShhcGlSZXZpZXdGb2xkZXIpIHx8ICdpbnZhbGlkJyxcbiAgICB9LFxuICAgIGRvY01vZGVsOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIGR0c1JvbGx1cDoge1xuICAgICAgZW5hYmxlZDogISFkdHNCdW5kbGVPdXQsXG4gICAgICB1bnRyaW1tZWRGaWxlUGF0aDogZHRzQnVuZGxlT3V0ICYmIHBhdGgucmVzb2x2ZShkdHNCdW5kbGVPdXQpLFxuICAgIH0sXG4gICAgdHNkb2NNZXRhZGF0YToge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IG9wdGlvbnM6IElFeHRyYWN0b3JDb25maWdQcmVwYXJlT3B0aW9ucyA9IHtcbiAgICBjb25maWdPYmplY3QsXG4gICAgcGFja2FnZUpzb246IHVuZGVmaW5lZCxcbiAgICBwYWNrYWdlSnNvbkZ1bGxQYXRoOiBwa2dKc29uLFxuICAgIGNvbmZpZ09iamVjdEZ1bGxQYXRoOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3QgZXh0cmFjdG9yQ29uZmlnID0gRXh0cmFjdG9yQ29uZmlnLnByZXBhcmUob3B0aW9ucyk7XG4gIGNvbnN0IHtzdWNjZWVkZWR9ID0gRXh0cmFjdG9yLmludm9rZShleHRyYWN0b3JDb25maWcsIGV4dHJhY3Rvck9wdGlvbnMpO1xuXG4gIC8vIEFQSSBleHRyYWN0b3IgZXJyb3JzIGFyZSBlbWl0dGVkIGJ5IGl0J3MgbG9nZ2VyLlxuICByZXR1cm4gc3VjY2VlZGVkID8gMCA6IDE7XG59XG5cbi8vIEVudHJ5IHBvaW50XG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgaWYgKERFQlVHKSB7XG4gICAgY29uc29sZS5lcnJvcihgXG5hcGktZXh0cmFjdG9yOiBydW5uaW5nIHdpdGhcbiAgY3dkOiAke3Byb2Nlc3MuY3dkKCl9XG4gIGFyZ3Y6XG4gICAgJHtwcm9jZXNzLmFyZ3Yuam9pbignXFxuICAgICcpfVxuICBgKTtcbiAgfVxuXG4gIGNvbnN0IFt0c0NvbmZpZywgZW50cnlQb2ludCwgZHRzQnVuZGxlT3V0XSA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcbiAgY29uc3QgZW50cnlQb2ludHMgPSBlbnRyeVBvaW50LnNwbGl0KCcsJyk7XG4gIGNvbnN0IGR0c0J1bmRsZU91dHMgPSBkdHNCdW5kbGVPdXQuc3BsaXQoJywnKTtcblxuICBpZiAoZW50cnlQb2ludHMubGVuZ3RoICE9PSBlbnRyeVBvaW50cy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVudHJ5IHBvaW50cyBjb3VudCAoJHtlbnRyeVBvaW50cy5sZW5ndGh9KSBkb2VzIG5vdCBtYXRjaCBCdW5kbGUgb3V0IGNvdW50ICgke1xuICAgICAgICBkdHNCdW5kbGVPdXRzLmxlbmd0aH0pYCk7XG4gIH1cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGVudHJ5UG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgcHJvY2Vzcy5leGl0Q29kZSA9IHJ1bk1haW4odHNDb25maWcsIGVudHJ5UG9pbnRzW2ldLCBkdHNCdW5kbGVPdXRzW2ldKTtcblxuICAgIGlmIChwcm9jZXNzLmV4aXRDb2RlICE9PSAwKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cbiJdfQ==