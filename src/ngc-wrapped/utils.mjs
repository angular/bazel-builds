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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvbmdjLXdyYXBwZWQvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7QUFHSCxPQUFPLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQztBQUN6QixPQUFPLEtBQUssSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUM3QixPQUFPLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFNUIsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDO0FBRXJDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxrQ0FBa0MsQ0FBQztBQUV0RCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsUUFBZ0IsRUFBRSxRQUFrQjtJQUNyRSxJQUFJLENBQUMsUUFBUTtRQUFFLE9BQU8sUUFBUSxDQUFDO0lBQy9CLHlEQUF5RDtJQUN6RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3pDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0MsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7WUFBRSxPQUFPLEdBQUcsQ0FBQztJQUN6QyxDQUFDO0lBQ0QsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUNBQW1DLENBQy9DLE1BQXNCLEVBQUUsWUFBZ0MsRUFBRSxRQUFrQixFQUM1RSxhQUFxQixFQUFFLG9CQUE4QixFQUNyRCw0QkFBcUM7SUFDdkMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUM1RCxNQUFNLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxnQkFBd0IsRUFBRSxrQkFBMkIsRUFBRSxFQUFFO1FBQ3RGLE1BQU0sUUFBUSxHQUFHLEdBQUcsZ0JBQWdCLElBQUksa0JBQWtCLEVBQUUsQ0FBQztRQUM3RCxvRUFBb0U7UUFDcEUsMkRBQTJEO1FBQzNELHdEQUF3RDtRQUN4RCxxRUFBcUU7UUFDckUsSUFBSSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUM1QyxPQUFPLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUUsQ0FBQztRQUNsRCxDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcsc0JBQXNCLENBQUMsZ0JBQWdCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUM1RSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUMsQ0FBQztJQUVGLFNBQVMsc0JBQXNCLENBQUMsZ0JBQXdCLEVBQUUsa0JBQTJCO1FBQ25GLE1BQU0sa0JBQWtCLEdBQUcsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMzRixNQUFNLGtCQUFrQixHQUFHLEdBQUcsYUFBYSxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDcEUsSUFBSSw0QkFBNEIsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUMxQyxPQUFPLGtCQUFrQixDQUFDO1FBQzVCLENBQUM7UUFFRCx3RkFBd0Y7UUFDeEYsc0ZBQXNGO1FBQ3RGLHlGQUF5RjtRQUN6RiwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDO1lBQ0gsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2xGLElBQUksVUFBVSxJQUFJLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDeEMsT0FBTyxVQUFVLENBQUMsVUFBVSxDQUFDO1lBQy9CLENBQUM7UUFDSCxDQUFDO1FBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNiLDZFQUE2RTtZQUM3RSwrQ0FBK0M7UUFDakQsQ0FBQztRQUVELHlGQUF5RjtRQUN6RixxREFBcUQ7UUFDckQsdURBQXVEO1FBQ3ZELG1GQUFtRjtRQUNuRixzRUFBc0U7UUFDdEUsMEZBQTBGO1FBQzFGLDZFQUE2RTtRQUM3RSxtREFBbUQ7UUFDbkQsd0RBQXdEO1FBQ3hELGdDQUFnQztRQUNoQywyQ0FBMkM7UUFDM0Msd0RBQXdEO1FBQ3hELDJFQUEyRTtRQUMzRSxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNsRCxNQUFNLGlCQUFpQixHQUFHLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsZ0JBQWdCLENBQUM7WUFDL0UsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQztnQkFDckMsTUFBTSxVQUFVLEdBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFFLEVBQUMsUUFBUSxFQUFFLE9BQU8sRUFBQyxDQUFDLENBRWpFLENBQUMsUUFBUSxDQUFDO2dCQUMvQixJQUFJLFVBQVUsRUFBRSxDQUFDO29CQUNmLE9BQU8sVUFBVSxDQUFDO2dCQUNwQixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQ3hGLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN6QixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLEVBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFrQixDQUFDLENBQUM7WUFDcEYsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQzFCLE9BQU8sT0FBTyxDQUFDO1lBQ2pCLENBQUM7UUFDSCxDQUFDO1FBRUQsMkZBQTJGO1FBQzNGLHlGQUF5RjtRQUN6Riw4QkFBOEI7UUFDOUIsbUZBQW1GO1FBQ25GLHNGQUFzRjtRQUN0Rix3RkFBd0Y7UUFDeEYsMkZBQTJGO1FBQzNGLDhEQUE4RDtRQUM5RCw4RkFBOEY7UUFDOUYsMERBQTBEO1FBQzFELDJGQUEyRjtRQUMzRiw0RkFBNEY7UUFDNUYsc0VBQXNFO1FBQ3RFLG9GQUFvRjtRQUNwRixJQUFJLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ2hELE9BQU8sa0JBQWtCLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2RCxDQUFDO2FBQU0sSUFBSSxrQkFBa0IsSUFBSSxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO1lBQzFGLE9BQU8sa0JBQWtCLENBQUM7UUFDNUIsQ0FBQztRQUNELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUN0RixPQUFPLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEtBQUssa0JBQWtCLEVBQUUsQ0FBQztJQUM3RixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEEgc2V0IG9mIGNvbW1vbiBoZWxwZXJzIHJlbGF0ZWQgdG8gbmcgY29tcGlsZXIgd3JhcHBlci5cbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVySG9zdCBhcyBOZ0NvbXBpbGVySG9zdH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmNvbnN0IE5PREVfTU9EVUxFUyA9ICdub2RlX21vZHVsZXMvJztcblxuZXhwb3J0IGNvbnN0IEVYVCA9IC8oXFwudHN8XFwuZFxcLnRzfFxcLmpzfFxcLmpzeHxcXC50c3gpJC87XG5cbmV4cG9ydCBmdW5jdGlvbiByZWxhdGl2ZVRvUm9vdERpcnMoZmlsZVBhdGg6IHN0cmluZywgcm9vdERpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGZpbGVQYXRoO1xuICAvLyBOQjogdGhlIHJvb3REaXJzIHNob3VsZCBoYXZlIGJlZW4gc29ydGVkIGxvbmdlc3QtZmlyc3RcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290RGlycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGRpciA9IHJvb3REaXJzW2ldO1xuICAgIGNvbnN0IHJlbCA9IHBhdGgucG9zaXgucmVsYXRpdmUoZGlyLCBmaWxlUGF0aCk7XG4gICAgaWYgKHJlbC5pbmRleE9mKCcuJykgIT09IDApIHJldHVybiByZWw7XG4gIH1cbiAgcmV0dXJuIGZpbGVQYXRoO1xufVxuXG4vKipcbiAqIEFkZHMgc3VwcG9ydCBmb3IgdGhlIG9wdGlvbmFsIGBmaWxlTmFtZVRvTW9kdWxlTmFtZWAgb3BlcmF0aW9uIHRvIGEgZ2l2ZW4gYG5nLkNvbXBpbGVySG9zdGAuXG4gKlxuICogVGhpcyBpcyB1c2VkIHdpdGhpbiBgbmdjLXdyYXBwZWRgIGFuZCB0aGUgQmF6ZWwgY29tcGlsYXRpb24gZmxvdywgYnV0IGlzIGV4cG9ydGVkIGhlcmUgdG8gYWxsb3dcbiAqIGZvciBvdGhlciBjb25zdW1lcnMgb2YgdGhlIGNvbXBpbGVyIHRvIGFjY2VzcyB0aGlzIHNhbWUgbG9naWMuIEZvciBleGFtcGxlLCB0aGUgeGkxOG4gb3BlcmF0aW9uXG4gKiBpbiBnMyBjb25maWd1cmVzIGl0cyBvd24gYG5nLkNvbXBpbGVySG9zdGAgd2hpY2ggYWxzbyByZXF1aXJlcyBgZmlsZU5hbWVUb01vZHVsZU5hbWVgIHRvIHdvcmtcbiAqIGNvcnJlY3RseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhdGNoTmdIb3N0V2l0aEZpbGVOYW1lVG9Nb2R1bGVOYW1lKFxuICAgIG5nSG9zdDogTmdDb21waWxlckhvc3QsIGNvbXBpbGVyT3B0czogdHMuQ29tcGlsZXJPcHRpb25zLCByb290RGlyczogc3RyaW5nW10sXG4gICAgd29ya3NwYWNlTmFtZTogc3RyaW5nLCBjb21waWxhdGlvblRhcmdldFNyYzogc3RyaW5nW10sXG4gICAgdXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZTogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgbmdIb3N0LmZpbGVOYW1lVG9Nb2R1bGVOYW1lID0gKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBgJHtpbXBvcnRlZEZpbGVQYXRofToke2NvbnRhaW5pbmdGaWxlUGF0aH1gO1xuICAgIC8vIE1lbW9pemUgdGhpcyBsb29rdXAgdG8gYXZvaWQgZXhwZW5zaXZlIHJlLXBhcnNlcyBvZiB0aGUgc2FtZSBmaWxlXG4gICAgLy8gV2hlbiBydW4gYXMgYSB3b3JrZXIsIHRoZSBhY3R1YWwgdHMuU291cmNlRmlsZSBpcyBjYWNoZWRcbiAgICAvLyBidXQgd2hlbiB3ZSBkb24ndCBydW4gYXMgYSB3b3JrZXIsIHRoZXJlIGlzIG5vIGNhY2hlLlxuICAgIC8vIEZvciBvbmUgZXhhbXBsZSB0YXJnZXQgaW4gZzMsIHdlIHNhdyBhIGNhY2hlIGhpdCByYXRlIG9mIDc1OTAvNzY5NVxuICAgIGlmIChmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmhhcyhjYWNoZUtleSkpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZVRvTW9kdWxlTmFtZUNhY2hlLmdldChjYWNoZUtleSkhO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGgsIGNvbnRhaW5pbmdGaWxlUGF0aCk7XG4gICAgZmlsZU5hbWVUb01vZHVsZU5hbWVDYWNoZS5zZXQoY2FjaGVLZXksIHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBmdW5jdGlvbiBkb0ZpbGVOYW1lVG9Nb2R1bGVOYW1lKGltcG9ydGVkRmlsZVBhdGg6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCByZWxhdGl2ZVRhcmdldFBhdGggPSByZWxhdGl2ZVRvUm9vdERpcnMoaW1wb3J0ZWRGaWxlUGF0aCwgcm9vdERpcnMpLnJlcGxhY2UoRVhULCAnJyk7XG4gICAgY29uc3QgbWFuaWZlc3RUYXJnZXRQYXRoID0gYCR7d29ya3NwYWNlTmFtZX0vJHtyZWxhdGl2ZVRhcmdldFBhdGh9YDtcbiAgICBpZiAodXNlTWFuaWZlc3RQYXRoc0FzTW9kdWxlTmFtZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIG1hbmlmZXN0VGFyZ2V0UGF0aDtcbiAgICB9XG5cbiAgICAvLyBVbmxlc3MgbWFuaWZlc3QgcGF0aHMgYXJlIGV4cGxpY2l0bHkgZW5mb3JjZWQsIHdlIGluaXRpYWxseSBjaGVjayBpZiBhIG1vZHVsZSBuYW1lIGlzXG4gICAgLy8gc2V0IGZvciB0aGUgZ2l2ZW4gc291cmNlIGZpbGUuIFRoZSBjb21waWxlciBob3N0IGZyb20gYEBiYXplbC9jb25jYXRqc2Agc2V0cyBzb3VyY2VcbiAgICAvLyBmaWxlIG1vZHVsZSBuYW1lcyBpZiB0aGUgY29tcGlsYXRpb24gdGFyZ2V0cyBlaXRoZXIgVU1EIG9yIEFNRC4gVG8gZW5zdXJlIHRoYXQgdGhlIEFNRFxuICAgIC8vIG1vZHVsZSBuYW1lcyBtYXRjaCwgd2UgZmlyc3QgY29uc2lkZXIgdGhvc2UuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBuZ0hvc3QuZ2V0U291cmNlRmlsZShpbXBvcnRlZEZpbGVQYXRoLCB0cy5TY3JpcHRUYXJnZXQuTGF0ZXN0KTtcbiAgICAgIGlmIChzb3VyY2VGaWxlICYmIHNvdXJjZUZpbGUubW9kdWxlTmFtZSkge1xuICAgICAgICByZXR1cm4gc291cmNlRmlsZS5tb2R1bGVOYW1lO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRmlsZSBkb2VzIG5vdCBleGlzdCBvciBwYXJzZSBlcnJvci4gSWdub3JlIHRoaXMgY2FzZSBhbmQgY29udGludWUgb250byB0aGVcbiAgICAgIC8vIG90aGVyIG1ldGhvZHMgb2YgcmVzb2x2aW5nIHRoZSBtb2R1bGUgYmVsb3cuXG4gICAgfVxuXG4gICAgLy8gSXQgY2FuIGhhcHBlbiB0aGF0IHRoZSBWaWV3RW5naW5lIGNvbXBpbGVyIG5lZWRzIHRvIHdyaXRlIGFuIGltcG9ydCBpbiBhIGZhY3RvcnkgZmlsZSxcbiAgICAvLyBhbmQgaXMgdXNpbmcgYW4gbmdzdW1tYXJ5IGZpbGUgdG8gZ2V0IHRoZSBzeW1ib2xzLlxuICAgIC8vIFRoZSBuZ3N1bW1hcnkgY29tZXMgZnJvbSBhbiB1cHN0cmVhbSBuZ19tb2R1bGUgcnVsZS5cbiAgICAvLyBUaGUgdXBzdHJlYW0gcnVsZSBiYXNlZCBpdHMgaW1wb3J0cyBvbiBuZ3N1bW1hcnkgZmlsZSB3aGljaCB3YXMgZ2VuZXJhdGVkIGZyb20gYVxuICAgIC8vIG1ldGFkYXRhLmpzb24gZmlsZSB0aGF0IHdhcyBwdWJsaXNoZWQgdG8gbnBtIGluIGFuIEFuZ3VsYXIgbGlicmFyeS5cbiAgICAvLyBIb3dldmVyLCB0aGUgbmdzdW1tYXJ5IGRvZXNuJ3QgcHJvcGFnYXRlIHRoZSAnaW1wb3J0QXMnIGZyb20gdGhlIG9yaWdpbmFsIG1ldGFkYXRhLmpzb25cbiAgICAvLyBzbyB3ZSB3b3VsZCBub3JtYWxseSBub3QgYmUgYWJsZSB0byBzdXBwbHkgdGhlIGNvcnJlY3QgbW9kdWxlIG5hbWUgZm9yIGl0LlxuICAgIC8vIEZvciBleGFtcGxlLCBpZiB0aGUgcm9vdERpci1yZWxhdGl2ZSBmaWxlUGF0aCBpc1xuICAgIC8vICBub2RlX21vZHVsZXMvQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gd2Ugd291bGQgc3VwcGx5IGEgbW9kdWxlIG5hbWVcbiAgICAvLyAgQGFuZ3VsYXIvbWF0ZXJpYWwvdG9vbGJhci90eXBpbmdzL2luZGV4XG4gICAgLy8gYnV0IHRoZXJlIGlzIG5vIEphdmFTY3JpcHQgZmlsZSB0byBsb2FkIGF0IHRoaXMgcGF0aC5cbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9pc3N1ZXMvMjk0NTRcbiAgICBpZiAoaW1wb3J0ZWRGaWxlUGF0aC5pbmRleE9mKCdub2RlX21vZHVsZXMnKSA+PSAwKSB7XG4gICAgICBjb25zdCBtYXliZU1ldGFkYXRhRmlsZSA9IGltcG9ydGVkRmlsZVBhdGgucmVwbGFjZShFWFQsICcnKSArICcubWV0YWRhdGEuanNvbic7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhtYXliZU1ldGFkYXRhRmlsZSkpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IChKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYXliZU1ldGFkYXRhRmlsZSwge2VuY29kaW5nOiAndXRmLTgnfSkpIGFzIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1wb3J0QXM6IHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuaW1wb3J0QXM7XG4gICAgICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG1vZHVsZU5hbWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuVU1EIHx8IGNvbXBpbGVyT3B0cy5tb2R1bGUgPT09IHRzLk1vZHVsZUtpbmQuQU1EKSAmJlxuICAgICAgICBuZ0hvc3QuYW1kTW9kdWxlTmFtZSkge1xuICAgICAgY29uc3QgYW1kTmFtZSA9IG5nSG9zdC5hbWRNb2R1bGVOYW1lKHtmaWxlTmFtZTogaW1wb3J0ZWRGaWxlUGF0aH0gYXMgdHMuU291cmNlRmlsZSk7XG4gICAgICBpZiAoYW1kTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBhbWROYW1lO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIG5vIEFNRCBtb2R1bGUgbmFtZSBoYXMgYmVlbiBzZXQgZm9yIHRoZSBzb3VyY2UgZmlsZSBieSB0aGUgYEBiYXplbC9jb25jYXRqc2AgY29tcGlsZXJcbiAgICAvLyBob3N0LCBhbmQgdGhlIHRhcmdldCBmaWxlIGlzIG5vdCBwYXJ0IG9mIGEgZmxhdCBtb2R1bGUgbm9kZSBtb2R1bGUgcGFja2FnZSwgd2UgdXNlIHRoZVxuICAgIC8vIGZvbGxvd2luZyBydWxlcyAoaW4gb3JkZXIpOlxuICAgIC8vICAgIDEuIElmIHRhcmdldCBmaWxlIGlzIHBhcnQgb2YgYG5vZGVfbW9kdWxlcy9gLCB3ZSB1c2UgdGhlIHBhY2thZ2UgbW9kdWxlIG5hbWUuXG4gICAgLy8gICAgMi4gSWYgbm8gY29udGFpbmluZyBmaWxlIGlzIHNwZWNpZmllZCwgb3IgdGhlIHRhcmdldCBmaWxlIGlzIHBhcnQgb2YgYSBkaWZmZXJlbnRcbiAgICAvLyAgICAgICBjb21waWxhdGlvbiB1bml0LCB3ZSB1c2UgYSBCYXplbCBtYW5pZmVzdCBwYXRoLiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IHBvc3NpYmxlXG4gICAgLy8gICAgICAgc2luY2Ugd2UgZG9uJ3QgaGF2ZSBhIGNvbnRhaW5pbmcgZmlsZSwgYW5kIHRoZSB0YXJnZXQgZmlsZSBjb3VsZCBiZSBsb2NhdGVkIGluIHRoZVxuICAgIC8vICAgICAgIG91dHB1dCBkaXJlY3RvcnksIG9yIGluIGFuIGV4dGVybmFsIEJhemVsIHJlcG9zaXRvcnkuXG4gICAgLy8gICAgMy4gSWYgYm90aCBydWxlcyBhYm92ZSBkaWRuJ3QgbWF0Y2gsIHdlIGNvbXB1dGUgYSByZWxhdGl2ZSBwYXRoIGJldHdlZW4gdGhlIHNvdXJjZSBmaWxlc1xuICAgIC8vICAgICAgIHNpbmNlIHRoZXkgYXJlIHBhcnQgb2YgdGhlIHNhbWUgY29tcGlsYXRpb24gdW5pdC5cbiAgICAvLyBOb3RlIHRoYXQgd2UgZG9uJ3Qgd2FudCB0byBhbHdheXMgdXNlICgyKSBiZWNhdXNlIGl0IGNvdWxkIG1lYW4gdGhhdCBjb21waWxhdGlvbiBvdXRwdXRzXG4gICAgLy8gYXJlIGFsd2F5cyBsZWFraW5nIEJhemVsLXNwZWNpZmljIHBhdGhzLCBhbmQgdGhlIG91dHB1dCBpcyBub3Qgc2VsZi1jb250YWluZWQuIFRoaXMgY291bGRcbiAgICAvLyBicmVhayBgZXNtMjAxNWAgb3IgYGVzbTVgIG91dHB1dCBmb3IgQW5ndWxhciBwYWNrYWdlIHJlbGVhc2Ugb3V0cHV0XG4gICAgLy8gT21pdCB0aGUgYG5vZGVfbW9kdWxlc2AgcHJlZml4IGlmIHRoZSBtb2R1bGUgbmFtZSBvZiBhbiBOUE0gcGFja2FnZSBpcyByZXF1ZXN0ZWQuXG4gICAgaWYgKHJlbGF0aXZlVGFyZ2V0UGF0aC5zdGFydHNXaXRoKE5PREVfTU9EVUxFUykpIHtcbiAgICAgIHJldHVybiByZWxhdGl2ZVRhcmdldFBhdGguc2xpY2UoTk9ERV9NT0RVTEVTLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChjb250YWluaW5nRmlsZVBhdGggPT0gbnVsbCB8fCAhY29tcGlsYXRpb25UYXJnZXRTcmMuaW5jbHVkZXMoaW1wb3J0ZWRGaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiBtYW5pZmVzdFRhcmdldFBhdGg7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRhaW5pbmdGaWxlRGlyID0gcGF0aC5kaXJuYW1lKHJlbGF0aXZlVG9Sb290RGlycyhjb250YWluaW5nRmlsZVBhdGgsIHJvb3REaXJzKSk7XG4gICAgY29uc3QgcmVsYXRpdmVJbXBvcnRQYXRoID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShjb250YWluaW5nRmlsZURpciwgcmVsYXRpdmVUYXJnZXRQYXRoKTtcbiAgICByZXR1cm4gcmVsYXRpdmVJbXBvcnRQYXRoLnN0YXJ0c1dpdGgoJy4nKSA/IHJlbGF0aXZlSW1wb3J0UGF0aCA6IGAuLyR7cmVsYXRpdmVJbXBvcnRQYXRofWA7XG4gIH1cbn1cbiJdfQ==