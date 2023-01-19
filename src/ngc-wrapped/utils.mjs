/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQztBQUN6QixPQUFPLEtBQUssSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUM3QixPQUFPLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFNUIsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0FBRXJDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztBQUV0RCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsUUFBZ0IsRUFBRSxRQUFrQjtJQUNyRSxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU8sUUFBUSxDQUFDO0lBQy9CLHlEQUF5RDtJQUN6RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN4QyxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQy9DLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO1lBQUUsT0FBTyxHQUFHLENBQUM7S0FDeEM7SUFDRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxtQ0FBbUMsQ0FDL0MsTUFBc0IsRUFBRSxZQUFnQyxFQUFFLFFBQWtCLEVBQzVFLGFBQXFCLEVBQUUsb0JBQThCLEVBQ3JELDRCQUFxQztJQUN2QyxNQUFNLHlCQUF5QixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFD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QUMzRix5RkFBeUY7UUFDekYsOEJBQThCO1FBQzlCLG1GQUFtRjtRQUNuRixzRkFBc0Y7UUFDdEYsd0ZBQXdGO1FBQ3hGLDJGQUEyRjtRQUMzRiw4REFBOEQ7UUFDOUQsOEZBQThGO1FBQzlGLDBEQUEwRDtRQUMxRCwyRkFBMkY7UUFDM0YsNEZBQTRGO1FBQzVGLHNFQUFzRTtRQUN0RSxvRkFBb0Y7UUFDcEYsSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDL0MsT0FBTyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3REO2FBQU0sSUFBSSxrQkFBa0IsSUFBSSxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUN6RixPQUFPLGtCQUFrQixDQUFDO1NBQzNCO1FBQ0QsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDekYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RGLE9BQU8sa0JBQWtCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxrQkFBa0IsRUFBRSxDQUFDO0lBQzdGLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgQSBzZXQgb2YgY29tbW9uIGhlbHBlcnMgcmVsYXRlZCB0byBuZyBjb21waWxlciB3cmFwcGVyLlxuICovXG5cbmltcG9ydCB7Q29tcGlsZXJIb3N0IGFzIE5nQ29tcGlsZXJIb3N0fSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuY29uc3QgTk9ERV9NT0RVTEVTID0gJ25vZGVfbW9kdWxlcy8nO1xuXG5leHBvcnQgY29uc3QgRVhUID0gLyhcXC50c3xcXC5kXFwudHN8XFwuanN8XFwuanN4fFxcLnRzeCkkLztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlbGF0aXZlVG9Sb290RGlycyhmaWxlUGF0aDogc3RyaW5nLCByb290RGlyczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gZmlsZVBhdGg7XG4gIC8vIE5COiB0aGUgcm9vdERpcnMgc2hvdWxkIGhhdmUgYmVlbiBzb3J0ZWQgbG9uZ2VzdC1maXJzdFxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3REaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZGlyID0gcm9vdERpcnNbaV07XG4gICAgY29uc3QgcmVsID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShkaXIsIGZpbGVQYXRoKTtcbiAgICBpZiAocmVsLmluZGV4T2YoJy4nKSAhPT0gMCkgcmV0dXJuIHJlbDtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbi8qKlxuICogQWRkcyBzdXBwb3J0IGZvciB0aGUgb3B0aW9uYWwgYGZpbGVOYW1lVG9Nb2R1bGVOYW1lYCBvcGVyYXRpb24gdG8gYSBnaXZlbiBgbmcuQ29tcGlsZXJIb3N0YC5cbiAqXG4gKiBUaGlzIGlzIHVzZWQgd2l0aGluIGBuZ2Mtd3JhcHBlZGAgYW5kIHRoZSBCYXplbCBjb21waWxhdGlvbiBmbG93LCBidXQgaXMgZXhwb3J0ZWQgaGVyZSB0byBhbGxvd1xuICogZm9yIG90aGVyIGNvbnN1bWVycyBvZiB0aGUgY29tcGlsZXIgdG8gYWNjZXNzIHRoaXMgc2FtZSBsb2dpYy4gRm9yIGV4YW1wbGUsIHRoZSB4aTE4biBvcGVyYXRpb25cbiAqIGluIGczIGNvbmZpZ3VyZXMgaXRzIG93biBgbmcuQ29tcGlsZXJIb3N0YCB3aGljaCBhbHNvIHJlcXVpcmVzIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgdG8gd29ya1xuICogY29ycmVjdGx5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGF0Y2hOZ0hvc3RXaXRoRmlsZU5hbWVUb01vZHVsZU5hbWUoXG4gICAgbmdIb3N0OiBOZ0NvbXBpbGVySG9zdCwgY29tcGlsZXJPcHRzOiB0cy5Db21waWxlck9wdGlvbnMsIHJvb3REaXJzOiBzdHJpbmdbXSxcbiAgICB3b3Jrc3BhY2VOYW1lOiBzdHJpbmcsIGNvbXBpbGF0aW9uVGFyZ2V0U3JjOiBzdHJpbmdbXSxcbiAgICB1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lOiBib29sZWFuKTogdm9pZCB7XG4gIGNvbnN0IGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBuZ0hvc3QuZmlsZU5hbWVUb01vZHVsZU5hbWUgPSAoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjYWNoZUtleSA9IGAke2ltcG9ydGVkRmlsZVBhdGh9OiR7Y29udGFpbmluZ0ZpbGVQYXRofWA7XG4gICAgLy8gTWVtb2l6ZSB0aGlzIGxvb2t1cCB0byBhdm9pZCBleHBlbnNpdmUgcmUtcGFyc2VzIG9mIHRoZSBzYW1lIGZpbGVcbiAgICAvLyBXaGVuIHJ1biBhcyBhIHdvcmtlciwgdGhlIGFjdHVhbCB0cy5Tb3VyY2VGaWxlIGlzIGNhY2hlZFxuICAgIC8vIGJ1dCB3aGVuIHdlIGRvbid0IHJ1biBhcyBhIHdvcmtlciwgdGhlcmUgaXMgbm8gY2FjaGUuXG4gICAgLy8gRm9yIG9uZSBleGFtcGxlIHRhcmdldCBpbiBnMywgd2Ugc2F3IGEgY2FjaGUgaGl0IHJhdGUgb2YgNzU5MC83Njk1XG4gICAgaWYgKGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lVG9Nb2R1bGVOYW1lQ2FjaGUuZ2V0KGNhY2hlS2V5KSE7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aCwgY29udGFpbmluZ0ZpbGVQYXRoKTtcbiAgICBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLnNldChjYWNoZUtleSwgcmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRvRmlsZU5hbWVUb01vZHVsZU5hbWUoaW1wb3J0ZWRGaWxlUGF0aDogc3RyaW5nLCBjb250YWluaW5nRmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlbGF0aXZlVGFyZ2V0UGF0aCA9IHJlbGF0aXZlVG9Sb290RGlycyhpbXBvcnRlZEZpbGVQYXRoLCByb290RGlycykucmVwbGFjZShFWFQsICcnKTtcbiAgICBjb25zdCBtYW5pZmVzdFRhcmdldFBhdGggPSBgJHt3b3Jrc3BhY2VOYW1lfS8ke3JlbGF0aXZlVGFyZ2V0UGF0aH1gO1xuICAgIGlmICh1c2VNYW5pZmVzdFBhdGhzQXNNb2R1bGVOYW1lID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gbWFuaWZlc3RUYXJnZXRQYXRoO1xuICAgIH1cblxuICAgIC8vIFVubGVzcyBtYW5pZmVzdCBwYXRocyBhcmUgZXhwbGljaXRseSBlbmZvcmNlZCwgd2UgaW5pdGlhbGx5IGNoZWNrIGlmIGEgbW9kdWxlIG5hbWUgaXNcbiAgICAvLyBzZXQgZm9yIHRoZSBnaXZlbiBzb3VyY2UgZmlsZS4gVGhlIGNvbXBpbGVyIGhvc3QgZnJvbSBgQGJhemVsL2NvbmNhdGpzYCBzZXRzIHNvdXJjZVxuICAgIC8vIGZpbGUgbW9kdWxlIG5hbWVzIGlmIHRoZSBjb21waWxhdGlvbiB0YXJnZXRzIGVpdGhlciBVTUQgb3IgQU1ELiBUbyBlbnN1cmUgdGhhdCB0aGUgQU1EXG4gICAgLy8gbW9kdWxlIG5hbWVzIG1hdGNoLCB3ZSBmaXJzdCBjb25zaWRlciB0aG9zZS5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IG5nSG9zdC5nZXRTb3VyY2VGaWxlKGltcG9ydGVkRmlsZVBhdGgsIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QpO1xuICAgICAgaWYgKHNvdXJjZUZpbGUgJiYgc291cmNlRmlsZS5tb2R1bGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzb3VyY2VGaWxlLm1vZHVsZU5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIHBhcnNlIGVycm9yLiBJZ25vcmUgdGhpcyBjYXNlIGFuZCBjb250aW51ZSBvbnRvIHRoZVxuICAgICAgLy8gb3RoZXIgbWV0aG9kcyBvZiByZXNvbHZpbmcgdGhlIG1vZHVsZSBiZWxvdy5cbiAgICB9XG5cbiAgICAvLyBJdCBjYW4gaGFwcGVuIHRoYXQgdGhlIFZpZXdFbmdpbmUgY29tcGlsZXIgbmVlZHMgdG8gd3JpdGUgYW4gaW1wb3J0IGluIGEgZmFjdG9yeSBmaWxlLFxuICAgIC8vIGFuZCBpcyB1c2luZyBhbiBuZ3N1bW1hcnkgZmlsZSB0byBnZXQgdGhlIHN5bWJvbHMuXG4gICAgLy8gVGhlIG5nc3VtbWFyeSBjb21lcyBmcm9tIGFuIHVwc3RyZWFtIG5nX21vZHVsZSBydWxlLlxuICAgIC8vIFRoZSB1cHN0cmVhbSBydWxlIGJhc2VkIGl0cyBpbXBvcnRzIG9uIG5nc3VtbWFyeSBmaWxlIHdoaWNoIHdhcyBnZW5lcmF0ZWQgZnJvbSBhXG4gICAgLy8gbWV0YWRhdGEuanNvbiBmaWxlIHRoYXQgd2FzIHB1Ymxpc2hlZCB0byBucG0gaW4gYW4gQW5ndWxhciBsaWJyYXJ5LlxuICAgIC8vIEhvd2V2ZXIsIHRoZSBuZ3N1bW1hcnkgZG9lc24ndCBwcm9wYWdhdGUgdGhlICdpbXBvcnRBcycgZnJvbSB0aGUgb3JpZ2luYWwgbWV0YWRhdGEuanNvblxuICAgIC8vIHNvIHdlIHdvdWxkIG5vcm1hbGx5IG5vdCBiZSBhYmxlIHRvIHN1cHBseSB0aGUgY29ycmVjdCBtb2R1bGUgbmFtZSBmb3IgaXQuXG4gICAgLy8gRm9yIGV4YW1wbGUsIGlmIHRoZSByb290RGlyLXJlbGF0aXZlIGZpbGVQYXRoIGlzXG4gICAgLy8gIG5vZGVfbW9kdWxlcy9AYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyB3ZSB3b3VsZCBzdXBwbHkgYSBtb2R1bGUgbmFtZVxuICAgIC8vICBAYW5ndWxhci9tYXRlcmlhbC90b29sYmFyL3R5cGluZ3MvaW5kZXhcbiAgICAvLyBidXQgdGhlcmUgaXMgbm8gSmF2YVNjcmlwdCBmaWxlIHRvIGxvYWQgYXQgdGhpcyBwYXRoLlxuICAgIC8vIFRoaXMgaXMgYSB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2lzc3Vlcy8yOTQ1NFxuICAgIGlmIChpbXBvcnRlZEZpbGVQYXRoLmluZGV4T2YoJ25vZGVfbW9kdWxlcycpID49IDApIHtcbiAgICAgIGNvbnN0IG1heWJlTWV0YWRhdGFGaWxlID0gaW1wb3J0ZWRGaWxlUGF0aC5yZXBsYWNlKEVYVCwgJycpICsgJy5tZXRhZGF0YS5qc29uJztcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKG1heWJlTWV0YWRhdGFGaWxlKSkge1xuICAgICAgICBjb25zdCBtb2R1bGVOYW1lID0gKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG1heWJlTWV0YWRhdGFGaWxlLCB7ZW5jb2Rpbmc6ICd1dGYtOCd9KSkgYXMge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbXBvcnRBczogc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5pbXBvcnRBcztcbiAgICAgICAgaWYgKG1vZHVsZU5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gbW9kdWxlTmFtZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5VTUQgfHwgY29tcGlsZXJPcHRzLm1vZHVsZSA9PT0gdHMuTW9kdWxlS2luZC5BTUQpICYmXG4gICAgICAgIG5nSG9zdC5hbWRNb2R1bGVOYW1lKSB7XG4gICAgICBjb25zdCBhbWROYW1lID0gbmdIb3N0LmFtZE1vZHVsZU5hbWUoe2ZpbGVOYW1lOiBpbXBvcnRlZEZpbGVQYXRofSBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgICAgIGlmIChhbWROYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIGFtZE5hbWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgbm8gQU1EIG1vZHVsZSBuYW1lIGhhcyBiZWVuIHNldCBmb3IgdGhlIHNvdXJjZSBmaWxlIGJ5IHRoZSBgQGJhemVsL2NvbmNhdGpzYCBjb21waWxlclxuICAgIC8vIGhvc3QsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgaXMgbm90IHBhcnQgb2YgYSBmbGF0IG1vZHVsZSBub2RlIG1vZHVsZSBwYWNrYWdlLCB3ZSB1c2UgdGhlXG4gICAgLy8gZm9sbG93aW5nIHJ1bGVzIChpbiBvcmRlcik6XG4gICAgLy8gICAgMS4gSWYgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBgbm9kZV9tb2R1bGVzL2AsIHdlIHVzZSB0aGUgcGFja2FnZSBtb2R1bGUgbmFtZS5cbiAgICAvLyAgICAyLiBJZiBubyBjb250YWluaW5nIGZpbGUgaXMgc3BlY2lmaWVkLCBvciB0aGUgdGFyZ2V0IGZpbGUgaXMgcGFydCBvZiBhIGRpZmZlcmVudFxuICAgIC8vICAgICAgIGNvbXBpbGF0aW9uIHVuaXQsIHdlIHVzZSBhIEJhemVsIG1hbmlmZXN0IHBhdGguIFJlbGF0aXZlIHBhdGhzIGFyZSBub3QgcG9zc2libGVcbiAgICAvLyAgICAgICBzaW5jZSB3ZSBkb24ndCBoYXZlIGEgY29udGFpbmluZyBmaWxlLCBhbmQgdGhlIHRhcmdldCBmaWxlIGNvdWxkIGJlIGxvY2F0ZWQgaW4gdGhlXG4gICAgLy8gICAgICAgb3V0cHV0IGRpcmVjdG9yeSwgb3IgaW4gYW4gZXh0ZXJuYWwgQmF6ZWwgcmVwb3NpdG9yeS5cbiAgICAvLyAgICAzLiBJZiBib3RoIHJ1bGVzIGFib3ZlIGRpZG4ndCBtYXRjaCwgd2UgY29tcHV0ZSBhIHJlbGF0aXZlIHBhdGggYmV0d2VlbiB0aGUgc291cmNlIGZpbGVzXG4gICAgLy8gICAgICAgc2luY2UgdGhleSBhcmUgcGFydCBvZiB0aGUgc2FtZSBjb21waWxhdGlvbiB1bml0LlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCB3YW50IHRvIGFsd2F5cyB1c2UgKDIpIGJlY2F1c2UgaXQgY291bGQgbWVhbiB0aGF0IGNvbXBpbGF0aW9uIG91dHB1dHNcbiAgICAvLyBhcmUgYWx3YXlzIGxlYWtpbmcgQmF6ZWwtc3BlY2lmaWMgcGF0aHMsIGFuZCB0aGUgb3V0cHV0IGlzIG5vdCBzZWxmLWNvbnRhaW5lZC4gVGhpcyBjb3VsZFxuICAgIC8vIGJyZWFrIGBlc20yMDE1YCBvciBgZXNtNWAgb3V0cHV0IGZvciBBbmd1bGFyIHBhY2thZ2UgcmVsZWFzZSBvdXRwdXRcbiAgICAvLyBPbWl0IHRoZSBgbm9kZV9tb2R1bGVzYCBwcmVmaXggaWYgdGhlIG1vZHVsZSBuYW1lIG9mIGFuIE5QTSBwYWNrYWdlIGlzIHJlcXVlc3RlZC5cbiAgICBpZiAocmVsYXRpdmVUYXJnZXRQYXRoLnN0YXJ0c1dpdGgoTk9ERV9NT0RVTEVTKSkge1xuICAgICAgcmV0dXJuIHJlbGF0aXZlVGFyZ2V0UGF0aC5zbGljZShOT0RFX01PRFVMRVMubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKGNvbnRhaW5pbmdGaWxlUGF0aCA9PSBudWxsIHx8ICFjb21waWxhdGlvblRhcmdldFNyYy5pbmNsdWRlcyhpbXBvcnRlZEZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG4gICAgY29uc3QgY29udGFpbmluZ0ZpbGVEaXIgPSBwYXRoLmRpcm5hbWUocmVsYXRpdmVUb1Jvb3REaXJzKGNvbnRhaW5pbmdGaWxlUGF0aCwgcm9vdERpcnMpKTtcbiAgICBjb25zdCByZWxhdGl2ZUltcG9ydFBhdGggPSBwYXRoLnBvc2l4LnJlbGF0aXZlKGNvbnRhaW5pbmdGaWxlRGlyLCByZWxhdGl2ZVRhcmdldFBhdGgpO1xuICAgIHJldHVybiByZWxhdGl2ZUltcG9ydFBhdGguc3RhcnRzV2l0aCgnLicpID8gcmVsYXRpdmVJbXBvcnRQYXRoIDogYC4vJHtyZWxhdGl2ZUltcG9ydFBhdGh9YDtcbiAgfVxufVxuIl19