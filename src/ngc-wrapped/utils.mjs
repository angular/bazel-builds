/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 *
 * @fileoverview A set of common helpers related to ng compiler wrapper.
 */
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
const NODE_MODULES = 'node_modules/';
export const EXT = /(\.ts|\.d\.ts|\.js|\.jsx|\.tsx)$/;
export function relativeToRootDirs(filePath, rootDirs) {
    if (!filePath)
        return filePath;
    // NB: the rootDirs should have been sorted longest-first
    for (let i = 0; i < rootDirs.length; i++) {
        const dir = rootDirs[i];
        const rel = path.posix.relative(dir, filePath);
        if (rel.indexOf('.') !== 0)
            return rel;
    }
    return filePath;
}
/**
 * Adds support for the optional `fileNameToModuleName` operation to a given `ng.CompilerHost`.
 *
 * This is used within `ngc-wrapped` and the Bazel compilation flow, but is exported here to allow
 * for other consumers of the compiler to access this same logic. For example, the xi18n operation
 * in g3 configures its own `ng.CompilerHost` which also requires `fileNameToModuleName` to work
 * correctly.
 */
export function patchNgHostWithFileNameToModuleName(ngHost, compilerOpts, rootDirs, workspaceName, compilationTargetSrc, useManifestPathsAsModuleName) {
    const fileNameToModuleNameCache = new Map();
    ngHost.fileNameToModuleName = (importedFilePath, containingFilePath) => {
        const cacheKey = `${importedFilePath}:${containingFilePath}`;
        // Memoize this lookup to avoid expensive re-parses of the same file
        // When run as a worker, the actual ts.SourceFile is cached
        // but when we don't run as a worker, there is no cache.
        // For one example target in g3, we saw a cache hit rate of 7590/7695
        if (fileNameToModuleNameCache.has(cacheKey)) {
            return fileNameToModuleNameCache.get(cacheKey);
        }
        const result = doFileNameToModuleName(importedFilePath, containingFilePath);
        fileNameToModuleNameCache.set(cacheKey, result);
        return result;
    };
    function doFileNameToModuleName(importedFilePath, containingFilePath) {
        const relativeTargetPath = relativeToRootDirs(importedFilePath, rootDirs).replace(EXT, '');
        const manifestTargetPath = `${workspaceName}/${relativeTargetPath}`;
        if (useManifestPathsAsModuleName === true) {
            return manifestTargetPath;
        }
        // Unless manifest paths are explicitly enforced, we initially check if a module name is
        // set for the given source file. The compiler host from `@bazel/concatjs` sets source
        // file module names if the compilation targets either UMD or AMD. To ensure that the AMD
        // module names match, we first consider those.
        try {
            const sourceFile = ngHost.getSourceFile(importedFilePath, ts.ScriptTarget.Latest);
            if (sourceFile && sourceFile.moduleName) {
                return sourceFile.moduleName;
            }
        }
        catch (err) {
            // File does not exist or parse error. Ignore this case and continue onto the
            // other methods of resolving the module below.
        }
        // It can happen that the ViewEngine compiler needs to write an import in a factory file,
        // and is using an ngsummary file to get the symbols.
        // The ngsummary comes from an upstream ng_module rule.
        // The upstream rule based its imports on ngsummary file which was generated from a
        // metadata.json file that was published to npm in an Angular library.
        // However, the ngsummary doesn't propagate the 'importAs' from the original metadata.json
        // so we would normally not be able to supply the correct module name for it.
        // For example, if the rootDir-relative filePath is
        //  node_modules/@angular/material/toolbar/typings/index
        // we would supply a module name
        //  @angular/material/toolbar/typings/index
        // but there is no JavaScript file to load at this path.
        // This is a workaround for https://github.com/angular/angular/issues/29454
        if (importedFilePath.indexOf('node_modules') >= 0) {
            const maybeMetadataFile = importedFilePath.replace(EXT, '') + '.metadata.json';
            if (fs.existsSync(maybeMetadataFile)) {
                const moduleName = JSON.parse(fs.readFileSync(maybeMetadataFile, { encoding: 'utf-8' })).importAs;
                if (moduleName) {
                    return moduleName;
                }
            }
        }
        if ((compilerOpts.module === ts.ModuleKind.UMD || compilerOpts.module === ts.ModuleKind.AMD) &&
            ngHost.amdModuleName) {
            const amdName = ngHost.amdModuleName({ fileName: importedFilePath });
            if (amdName !== undefined) {
                return amdName;
            }
        }
        // If no AMD module name has been set for the source file by the `@bazel/concatjs` compiler
        // host, and the target file is not part of a flat module node module package, we use the
        // following rules (in order):
        //    1. If target file is part of `node_modules/`, we use the package module name.
        //    2. If no containing file is specified, or the target file is part of a different
        //       compilation unit, we use a Bazel manifest path. Relative paths are not possible
        //       since we don't have a containing file, and the target file could be located in the
        //       output directory, or in an external Bazel repository.
        //    3. If both rules above didn't match, we compute a relative path between the source files
        //       since they are part of the same compilation unit.
        // Note that we don't want to always use (2) because it could mean that compilation outputs
        // are always leaking Bazel-specific paths, and the output is not self-contained. This could
        // break `esm2015` or `esm5` output for Angular package release output
        // Omit the `node_modules` prefix if the module name of an NPM package is requested.
        if (relativeTargetPath.startsWith(NODE_MODULES)) {
            return relativeTargetPath.slice(NODE_MODULES.length);
        }
        else if (containingFilePath == null || !compilationTargetSrc.includes(importedFilePath)) {
            return manifestTargetPath;
        }
        const containingFileDir = path.dirname(relativeToRootDirs(containingFilePath, rootDirs));
        const relativeImportPath = path.posix.relative(containingFileDir, relativeTargetPath);
        return relativeImportPath.startsWith('.') ? relativeImportPath : `./${relativeImportPath}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQztBQUN6QixPQUFPLEtBQUssSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUM3QixPQUFPLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFNUIsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0FBRXJDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztBQUV0RCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsUUFBZ0IsRUFBRSxRQUFrQjtJQUNyRSxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU8sUUFBUSxDQUFDO0lBQy9CLHlEQUF5RDtJQUN6RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3pDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0MsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7WUFBRSxPQUFPLEdBQUcsQ0FBQztJQUN6QyxDQUFDO0lBQ0QsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUNBQW1DLENBQ2pELE1BQXNCLEVBQ3RCLFlBQWdDLEVBQ2hDLFFBQWtCLEVBQ2xCLGFBQXFCLEVBQ3JCLG9CQUE4QixFQUM5Qiw0QkFBcUM7SUFFckMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLEdB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QWdCLEVBQWtCLENBQUMsQ0FBQztZQUNwRixJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDMUIsT0FBTyxPQUFPLENBQUM7WUFDakIsQ0FBQztRQUNILENBQUM7UUFFRCwyRkFBMkY7UUFDM0YseUZBQXlGO1FBQ3pGLDhCQUE4QjtRQUM5QixtRkFBbUY7UUFDbkYsc0ZBQXNGO1FBQ3RGLHdGQUF3RjtRQUN4RiwyRkFBMkY7UUFDM0YsOERBQThEO1FBQzlELDhGQUE4RjtRQUM5RiwwREFBMEQ7UUFDMUQsMkZBQTJGO1FBQzNGLDRGQUE0RjtRQUM1RixzRUFBc0U7UUFDdEUsb0ZBQW9GO1FBQ3BGLElBQUksa0JBQWtCLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDaEQsT0FBTyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELENBQUM7YUFBTSxJQUFJLGtCQUFrQixJQUFJLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7WUFDMUYsT0FBTyxrQkFBa0IsQ0FBQztRQUM1QixDQUFDO1FBQ0QsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDekYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RGLE9BQU8sa0JBQWtCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxrQkFBa0IsRUFBRSxDQUFDO0lBQzdGLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuZGV2L2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEEgc2V0IG9mIGNvbW1vbiBoZWxwZXJzIHJlbGF0ZWQgdG8gbmcgY29tcGlsZXIgd3JhcHBlci5cbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVySG9zdCBhcyBOZ0NvbXBpbGVySG9zdH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT09IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG4vKipcbiAqIEFkZHMgc3VwcG9ydCBmb3IgdGhlIG9wdGlvbmFsIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgb3BlcmF0aW9uIHRvIGEgZ2l2ZW4gYG5nLkNvbXBpbGVySG9zdGAuXG4gKlxuICogVGhpcyBpcyB1c2VkIHdpdGhpbiBgbmdjLXdyYXBwZWRgIGFuZCB0aGUgQmF6ZWwgY29tcGlsYXRpb24gZmxvdywgYnV0IGlzIGV4cG9ydGVkIGhlcmUgdG8gYWxsb3dcbiAqIGZvciBvdGhlciBjb25zdW1lcnMgb2YgdGhlIGNvbXBpbGVyIHRvIGFjY2VzcyB0aGlzIHNhbWUgbG9naWMuIEZvciBleGFtcGxlLCB0aGUgeGkxOG4gb3BlcmF0aW9uXG4gKiBpbiBnMyBjb25maWd1cmVzIGl0cyBvd24gYG5nLkNvbXBpbGVySG9zdGAgd2hpY2ggYWxzbyByZXF1aXJlcyBgZmlsZU5hbWVUb01vZHVsZU5hbWVgIHRvIHdvcmtcbiAqIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICBuZ0hvc3Q6IE5nQ29tcGlsZXJIb3N0LFxuICBjb21waWxlck9wdHM6IHRzLkNvbXBpbGVyT3B0aW9ucyxcbiAgcm9vdERpcnM6IHN0cmluZ1tdLFxuICB3b3Jrc3BhY2VOYW1lOiBzdHJpbmcsXG4gIGNvbXBpbGF0aW9uVGFyZ2V0U3JjOiBzdHJpbmdbXSxcbiAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogYm9vbGVhbixcbik6IHZvaWQge1xuICBjb25zdCBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgbmdIb3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lID0gKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBgJHtpbXBvcnRlZEZpbGVQYXRofToke2NvbnRhaW5pbmdGaWxlUGF0aH1gO1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhjYWNoZUtleSkpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmdldChjYWNoZUtleSkhO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgsIGNvbnRhaW5pbmdGaWxlUGF0aCk7XG4gICAgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5zZXQoY2FjaGVLZXksIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBmdW5jdGlvbiBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCByZWxhdGl2ZVRhcmdldFBhdGggPSByZWxhdGl2ZVRvUm9vdERpcnMoaW1wb3J0ZWRGaWxlUGF0aCwgcm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgY29uc3QgbWFuaWZlc3RUYXJnZXRQYXRoID0gYCR7d29ya3NwYWNlTmFtZX0vJHtyZWxhdGl2ZVRhcmdldFBhdGh9YDtcbiAgICBpZiAodXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG5cbiAgICAvLyBVbmxlc3MgbWFuaWZlc3QgcGF0aHMgYXJlIGV4cGxpY2l0bHkgZW5mb3JjZWQsIHdlIGluaXRpYWxseSBjaGVjayBpZiBhIG1vZHVsZSBuYW1lIGlzXG4gICAgLy8gc2V0IGZvciB0aGUgZ2l2ZW4gc291cmNlIGZpbGUuIFRoZSBjb21waWxlciBob3N0IGZyb20gYEBiYXplbC9jb25jYXRqc2Agc2V0cyBzb3VyY2VcbiAgICAvLyBmaWxlIG1vZHVsZSBuYW1lcyBpZiB0aGUgY29tcGlsYXRpb24gdGFyZ2V0cyBlaXRoZXIgVU1EIG9yIEFNRC4gVG8gZW5zdXJlIHRoYXQgdGhlIEFNRFxuICAgIC8vIG1vZHVsZSBuYW1lcyBtYXRjaCwgd2UgZmlyc3QgY29uc2lkZXIgdGhvc2UuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IChcbiAgICAgICAgICBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpIGFzIHtcbiAgICAgICAgICAgIGltcG9ydEFzOiBzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICApLmltcG9ydEFzO1xuICAgICAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgICAgIHJldHVybiBtb2R1bGVOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgbmdIb3N0LmFtZE1vZHVsZU5hbWVcbiAgICApIHtcbiAgICAgIGNvbnN0IGFtZE5hbWUgPSBuZ0hvc3QuYW1kTW9kdWxlTmFtZSh7ZmlsZU5hbWU6IGltcG9ydGVkRmlsZVBhdGh9IGFzIHRzLlNvdXJjZUZpbGUpO1xuICAgICAgaWYgKGFtZE5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gYW1kTmFtZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBubyBBTUQgbW9kdWxlIG5hbWUgaGFzIGJlZW4gc2V0IGZvciB0aGUgc291cmNlIGZpbGUgYnkgdGhlIGBAYmF6ZWwvY29uY2F0anNgIGNvbXBpbGVyXG4gICAgLy8gaG9zdCwgYW5kIHRoZSB0YXJnZXQgZmlsZSBpcyBub3QgcGFydCBvZiBhIGZsYXQgbW9kdWxlIG5vZGUgbW9kdWxlIHBhY2thZ2UsIHdlIHVzZSB0aGVcbiAgICAvLyBmb2xsb3dpbmcgcnVsZXMgKGluIG9yZGVyKTpcbiAgICAvLyAgICAxLiBJZiB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGBub2RlX21vZHVsZXMvYCwgd2UgdXNlIHRoZSBwYWNrYWdlIG1vZHVsZSBuYW1lLlxuICAgIC8vICAgIDIuIElmIG5vIGNvbnRhaW5pbmcgZmlsZSBpcyBzcGVjaWZpZWQsIG9yIHRoZSB0YXJnZXQgZmlsZSBpcyBwYXJ0IG9mIGEgZGlmZmVyZW50XG4gICAgLy8gICAgICAgY29tcGlsYXRpb24gdW5pdCwgd2UgdXNlIGEgQmF6ZWwgbWFuaWZlc3QgcGF0aC4gUmVsYXRpdmUgcGF0aHMgYXJlIG5vdCBwb3NzaWJsZVxuICAgIC8vICAgICAgIHNpbmNlIHdlIGRvbid0IGhhdmUgYSBjb250YWluaW5nIGZpbGUsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgY291bGQgYmUgbG9jYXRlZCBpbiB0aGVcbiAgICAvLyAgICAgICBvdXRwdXQgZGlyZWN0b3J5LCBvciBpbiBhbiBleHRlcm5hbCBCYXplbCByZXBvc2l0b3J5LlxuICAgIC8vICAgIDMuIElmIGJvdGggcnVsZXMgYWJvdmUgZGlkbid0IG1hdGNoLCB3ZSBjb21wdXRlIGEgcmVsYXRpdmUgcGF0aCBiZXR3ZWVuIHRoZSBzb3VyY2UgZmlsZXNcbiAgICAvLyAgICAgICBzaW5jZSB0aGV5IGFyZSBwYXJ0IG9mIHRoZSBzYW1lIGNvbXBpbGF0aW9uIHVuaXQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IHdhbnQgdG8gYWx3YXlzIHVzZSAoMikgYmVjYXVzZSBpdCBjb3VsZCBtZWFuIHRoYXQgY29tcGlsYXRpb24gb3V0cHV0c1xuICAgIC8vIGFyZSBhbHdheXMgbGVha2luZyBCYXplbC1zcGVjaWZpYyBwYXRocywgYW5kIHRoZSBvdXRwdXQgaXMgbm90IHNlbGYtY29udGFpbmVkLiBUaGlzIGNvdWxkXG4gICAgLy8gYnJlYWsgYGVzbTIwMTVgIG9yIGBlc201YCBvdXRwdXQgZm9yIEFuZ3VsYXIgcGFja2FnZSByZWxlYXNlIG91dHB1dFxuICAgIC8vIE9taXQgdGhlIGBub2RlX21vZHVsZXNgIHByZWZpeCBpZiB0aGUgbW9kdWxlIG5hbWUgb2YgYW4gTlBNIHBhY2thZ2UgaXMgcmVxdWVzdGVkLlxuICAgIGlmIChyZWxhdGl2ZVRhcmdldFBhdGguc3RhcnRzV2l0aChOT0RFX01PRFVMRVMpKSB7XG4gICAgICByZXR1cm4gcmVsYXRpdmVUYXJnZXRQYXRoLnNsaWNlKE5PREVfTU9EVUxFUy5sZW5ndGgpO1xuICAgIH0gZWxzZSBpZiAoY29udGFpbmluZ0ZpbGVQYXRoID09IG51bGwgfHwgIWNvbXBpbGF0aW9uVGFyZ2V0U3JjLmluY2x1ZGVzKGltcG9ydGVkRmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cbiAgICBjb25zdCBjb250YWluaW5nRmlsZURpciA9IHBhdGguZGlybmFtZShyZWxhdGl2ZVRvUm9vdERpcnMoY29udGFpbmluZ0ZpbGVQYXRoLCByb290RGlycykpO1xuICAgIGNvbnN0IHJlbGF0aXZlSW1wb3J0UGF0aCA9IHBhdGgucG9zaXgucmVsYXRpdmUoY29udGFpbmluZ0ZpbGVEaXIsIHJlbGF0aXZlVGFyZ2V0UGF0aCk7XG4gICAgcmV0dXJuIHJlbGF0aXZlSW1wb3J0UGF0aC5zdGFydHNXaXRoKCcuJykgPyByZWxhdGl2ZUltcG9ydFBhdGggOiBgLi8ke3JlbGF0aXZlSW1wb3J0UGF0aH1gO1xuICB9XG59XG4iXX0=