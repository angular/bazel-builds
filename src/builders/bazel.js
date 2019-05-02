/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
        define("@angular/bazel/src/builders/bazel", ["require", "exports", "tslib", "child_process", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types='node'/>
    var child_process_1 = require("child_process");
    var fs_1 = require("fs");
    var path_1 = require("path");
    /**
     * Spawn the Bazel process. Trap SINGINT to make sure Bazel process is killed.
     */
    function runBazel(projectDir, binary, command, workspaceTarget, flags) {
        projectDir = path_1.normalize(projectDir);
        binary = path_1.normalize(binary);
        return new Promise(function (resolve, reject) {
            var buildProcess = child_process_1.fork(binary, tslib_1.__spread([command, workspaceTarget], flags), {
                cwd: projectDir,
                stdio: 'inherit',
            });
            process.on('SIGINT', function (signal) {
                if (!buildProcess.killed) {
                    buildProcess.kill();
                    reject(new Error("Bazel process received " + signal + "."));
                }
            });
            buildProcess.once('close', function (code) {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(binary + " failed with code " + code + "."));
                }
            });
        });
    }
    exports.runBazel = runBazel;
    /**
     * Resolves the path to `@bazel/bazel` or `@bazel/ibazel`.
     */
    function checkInstallation(name, projectDir) {
        projectDir = path_1.normalize(projectDir);
        var packageName = "@bazel/" + name + "/package.json";
        try {
            var bazelPath = require.resolve(packageName, {
                paths: [projectDir],
            });
            return path_1.dirname(bazelPath);
        }
        catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error("Could not run " + name + ". Please make sure that the " +
                    ("\"" + name + "\" command is installed by running ") +
                    ("\"npm install " + packageName + "\" or \"yarn install " + packageName + "\"."));
            }
            throw error;
        }
    }
    exports.checkInstallation = checkInstallation;
    /**
     * Returns the absolute path to the template directory in `@angular/bazel`.
     */
    function getTemplateDir(root) {
        root = path_1.normalize(root);
        var packageJson = require.resolve('@angular/bazel/package.json', {
            paths: [root],
        });
        var packageDir = path_1.dirname(packageJson);
        var templateDir = path_1.join(packageDir, 'src', 'builders', 'files');
        if (!fs_1.statSync(templateDir).isDirectory()) {
            throw new Error('Could not find Bazel template directory in "@angular/bazel".');
        }
        return templateDir;
    }
    exports.getTemplateDir = getTemplateDir;
    /**
     * Recursively list the specified 'dir' using depth-first approach. Paths
     * returned are relative to 'dir'.
     */
    function listR(dir) {
        function list(dir, root, results) {
            var e_1, _a;
            var paths = fs_1.readdirSync(dir);
            try {
                for (var paths_1 = tslib_1.__values(paths), paths_1_1 = paths_1.next(); !paths_1_1.done; paths_1_1 = paths_1.next()) {
                    var path = paths_1_1.value;
                    var absPath = path_1.join(dir, path);
                    var relPath = path_1.join(root, path);
                    if (fs_1.statSync(absPath).isFile()) {
                        results.push(relPath);
                    }
                    else {
                        list(absPath, relPath, results);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (paths_1_1 && !paths_1_1.done && (_a = paths_1.return)) _a.call(paths_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return results;
        }
        return list(dir, '', []);
    }
    /**
     * Copy Bazel files (WORKSPACE, BUILD.bazel, etc) from the template directory to
     * the project `root` directory, and return the absolute paths of the files
     * copied, so that they can be deleted later.
     * Existing files in `root` will not be replaced.
     */
    function copyBazelFiles(root, templateDir) {
        var e_2, _a;
        root = path_1.normalize(root);
        templateDir = path_1.normalize(templateDir);
        var bazelFiles = [];
        var templates = listR(templateDir);
        try {
            for (var templates_1 = tslib_1.__values(templates), templates_1_1 = templates_1.next(); !templates_1_1.done; templates_1_1 = templates_1.next()) {
                var template = templates_1_1.value;
                var name_1 = template.replace('__dot__', '.').replace('.template', '');
                var source = path_1.join(templateDir, template);
                var dest = path_1.join(root, name_1);
                try {
                    if (!fs_1.existsSync(dest)) {
                        fs_1.copyFileSync(source, dest);
                        bazelFiles.push(dest);
                    }
                }
                catch (_b) {
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (templates_1_1 && !templates_1_1.done && (_a = templates_1.return)) _a.call(templates_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return bazelFiles;
    }
    exports.copyBazelFiles = copyBazelFiles;
    /**
     * Delete the specified 'files'. This function never throws.
     */
    function deleteBazelFiles(files) {
        var e_3, _a;
        try {
            for (var files_1 = tslib_1.__values(files), files_1_1 = files_1.next(); !files_1_1.done; files_1_1 = files_1.next()) {
                var file = files_1_1.value;
                try {
                    fs_1.unlinkSync(file);
                }
                catch (_b) {
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (files_1_1 && !files_1_1.done && (_a = files_1.return)) _a.call(files_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
    }
    exports.deleteBazelFiles = deleteBazelFiles;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBRTdCLCtDQUFtQztJQUNuQyx5QkFBK0U7SUFDL0UsNkJBQThDO0lBSzlDOztPQUVHO0lBQ0gsU0FBZ0IsUUFBUSxDQUNwQixVQUFrQixFQUFFLE1BQWMsRUFBRSxPQUFnQixFQUFFLGVBQXVCLEVBQzdFLEtBQWU7UUFDakIsVUFBVSxHQUFHLGdCQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkMsTUFBTSxHQUFHLGdCQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFDLE9BQU8sRUFBRSxNQUFNO1lBQ2pDLElBQU0sWUFBWSxHQUFHLG9CQUFJLENBQUMsTUFBTSxvQkFBRyxPQUFPLEVBQUUsZUFBZSxHQUFLLEtBQUssR0FBRztnQkFDdEUsR0FBRyxFQUFFLFVBQVU7Z0JBQ2YsS0FBSyxFQUFFLFNBQVM7YUFDakIsQ0FBQyxDQUFDO1lBRUgsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBQyxNQUFNO2dCQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRTtvQkFDeEIsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNwQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsNEJBQTBCLE1BQU0sTUFBRyxDQUFDLENBQUMsQ0FBQztpQkFDeEQ7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsSUFBWTtnQkFDdEMsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO29CQUNkLE9BQU8sRUFBRSxDQUFDO2lCQUNYO3FCQUFNO29CQUNMLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBSSxNQUFNLDBCQUFxQixJQUFJLE1BQUcsQ0FBQyxDQUFDLENBQUM7aUJBQzFEO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUExQkQsNEJBMEJDO0lBRUQ7O09BRUc7SUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxJQUFnQixFQUFFLFVBQWtCO1FBQ3BFLFVBQVUsR0FBRyxnQkFBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25DLElBQU0sV0FBVyxHQUFHLFlBQVUsSUFBSSxrQkFBZSxDQUFDO1FBQ2xELElBQUk7WUFDRixJQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRTtnQkFDN0MsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDO2FBQ3BCLENBQUMsQ0FBQztZQUNILE9BQU8sY0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzNCO1FBQUMsT0FBTyxLQUFLLEVBQUU7WUFDZCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssa0JBQWtCLEVBQUU7Z0JBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQ1gsbUJBQWlCLElBQUksaUNBQThCO3FCQUNuRCxPQUFJLElBQUksd0NBQW9DLENBQUE7cUJBQzVDLG1CQUFnQixXQUFXLDZCQUFzQixXQUFXLFFBQUksQ0FBQSxDQUFDLENBQUM7YUFDdkU7WUFDRCxNQUFNLEtBQUssQ0FBQztTQUNiO0lBQ0gsQ0FBQztJQWpCRCw4Q0FpQkM7SUFFRDs7T0FFRztJQUNILFNBQWdCLGNBQWMsQ0FBQyxJQUFZO1FBQ3pDLElBQUksR0FBRyxnQkFBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZCLElBQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsNkJBQTZCLEVBQUU7WUFDakUsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDO1NBQ2QsQ0FBQyxDQUFDO1FBQ0gsSUFBTSxVQUFVLEdBQUcsY0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3hDLElBQU0sV0FBVyxHQUFHLFdBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsYUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsOERBQThELENBQUMsQ0FBQztTQUNqRjtRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFYRCx3Q0FXQztJQUVEOzs7T0FHRztJQUNILFNBQVMsS0FBSyxDQUFDLEdBQVc7UUFDeEIsU0FBUyxJQUFJLENBQUMsR0FBVyxFQUFFLElBQVksRUFBRSxPQUFpQjs7WUFDeEQsSUFBTSxLQUFLLEdBQUcsZ0JBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7Z0JBQy9CLEtBQW1CLElBQUEsVUFBQSxpQkFBQSxLQUFLLENBQUEsNEJBQUEsK0NBQUU7b0JBQXJCLElBQU0sSUFBSSxrQkFBQTtvQkFDYixJQUFNLE9BQU8sR0FBRyxXQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNoQyxJQUFNLE9BQU8sR0FBRyxXQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNqQyxJQUFJLGFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTt3QkFDOUIsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztxQkFDdkI7eUJBQU07d0JBQ0wsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7cUJBQ2pDO2lCQUNGOzs7Ozs7Ozs7WUFDRCxPQUFPLE9BQU8sQ0FBQztRQUNqQixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxTQUFnQixjQUFjLENBQUMsSUFBWSxFQUFFLFdBQW1COztRQUM5RCxJQUFJLEdBQUcsZ0JBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QixXQUFXLEdBQUcsZ0JBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNyQyxJQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7UUFDaEMsSUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDOztZQUVyQyxLQUF1QixJQUFBLGNBQUEsaUJBQUEsU0FBUyxDQUFBLG9DQUFBLDJEQUFFO2dCQUE3QixJQUFNLFFBQVEsc0JBQUE7Z0JBQ2pCLElBQU0sTUFBSSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3ZFLElBQU0sTUFBTSxHQUFHLFdBQUksQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQzNDLElBQU0sSUFBSSxHQUFHLFdBQUksQ0FBQyxJQUFJLEVBQUUsTUFBSSxDQUFDLENBQUM7Z0JBQzlCLElBQUk7b0JBQ0YsSUFBSSxDQUFDLGVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTt3QkFDckIsaUJBQVksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7d0JBQzNCLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ3ZCO2lCQUNGO2dCQUFDLFdBQU07aUJBQ1A7YUFDRjs7Ozs7Ozs7O1FBRUQsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQXBCRCx3Q0FvQkM7SUFFRDs7T0FFRztJQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWU7OztZQUM5QyxLQUFtQixJQUFBLFVBQUEsaUJBQUEsS0FBSyxDQUFBLDRCQUFBLCtDQUFFO2dCQUFyQixJQUFNLElBQUksa0JBQUE7Z0JBQ2IsSUFBSTtvQkFDRixlQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQ2xCO2dCQUFDLFdBQU07aUJBQ1A7YUFDRjs7Ozs7Ozs7O0lBQ0gsQ0FBQztJQVBELDRDQU9DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz0nbm9kZScvPlxuXG5pbXBvcnQge2Zvcmt9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHtjb3B5RmlsZVN5bmMsIGV4aXN0c1N5bmMsIHJlYWRkaXJTeW5jLCBzdGF0U3luYywgdW5saW5rU3luY30gZnJvbSAnZnMnO1xuaW1wb3J0IHtkaXJuYW1lLCBqb2luLCBub3JtYWxpemV9IGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgdHlwZSBFeGVjdXRhYmxlID0gJ2JhemVsJyB8ICdpYmF6ZWwnO1xuZXhwb3J0IHR5cGUgQ29tbWFuZCA9ICdidWlsZCcgfCAndGVzdCcgfCAncnVuJyB8ICdjb3ZlcmFnZScgfCAncXVlcnknO1xuXG4vKipcbiAqIFNwYXduIHRoZSBCYXplbCBwcm9jZXNzLiBUcmFwIFNJTkdJTlQgdG8gbWFrZSBzdXJlIEJhemVsIHByb2Nlc3MgaXMga2lsbGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcnVuQmF6ZWwoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLCBiaW5hcnk6IHN0cmluZywgY29tbWFuZDogQ29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0OiBzdHJpbmcsXG4gICAgZmxhZ3M6IHN0cmluZ1tdKSB7XG4gIHByb2plY3REaXIgPSBub3JtYWxpemUocHJvamVjdERpcik7XG4gIGJpbmFyeSA9IG5vcm1hbGl6ZShiaW5hcnkpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGJ1aWxkUHJvY2VzcyA9IGZvcmsoYmluYXJ5LCBbY29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0LCAuLi5mbGFnc10sIHtcbiAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgfSk7XG5cbiAgICBwcm9jZXNzLm9uKCdTSUdJTlQnLCAoc2lnbmFsKSA9PiB7XG4gICAgICBpZiAoIWJ1aWxkUHJvY2Vzcy5raWxsZWQpIHtcbiAgICAgICAgYnVpbGRQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgQmF6ZWwgcHJvY2VzcyByZWNlaXZlZCAke3NpZ25hbH0uYCkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYnVpbGRQcm9jZXNzLm9uY2UoJ2Nsb3NlJywgKGNvZGU6IG51bWJlcikgPT4ge1xuICAgICAgaWYgKGNvZGUgPT09IDApIHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgJHtiaW5hcnl9IGZhaWxlZCB3aXRoIGNvZGUgJHtjb2RlfS5gKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIFJlc29sdmVzIHRoZSBwYXRoIHRvIGBAYmF6ZWwvYmF6ZWxgIG9yIGBAYmF6ZWwvaWJhemVsYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrSW5zdGFsbGF0aW9uKG5hbWU6IEV4ZWN1dGFibGUsIHByb2plY3REaXI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHByb2plY3REaXIgPSBub3JtYWxpemUocHJvamVjdERpcik7XG4gIGNvbnN0IHBhY2thZ2VOYW1lID0gYEBiYXplbC8ke25hbWV9L3BhY2thZ2UuanNvbmA7XG4gIHRyeSB7XG4gICAgY29uc3QgYmF6ZWxQYXRoID0gcmVxdWlyZS5yZXNvbHZlKHBhY2thZ2VOYW1lLCB7XG4gICAgICBwYXRoczogW3Byb2plY3REaXJdLFxuICAgIH0pO1xuICAgIHJldHVybiBkaXJuYW1lKGJhemVsUGF0aCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDb3VsZCBub3QgcnVuICR7bmFtZX0uIFBsZWFzZSBtYWtlIHN1cmUgdGhhdCB0aGUgYCArXG4gICAgICAgICAgYFwiJHtuYW1lfVwiIGNvbW1hbmQgaXMgaW5zdGFsbGVkIGJ5IHJ1bm5pbmcgYCArXG4gICAgICAgICAgYFwibnBtIGluc3RhbGwgJHtwYWNrYWdlTmFtZX1cIiBvciBcInlhcm4gaW5zdGFsbCAke3BhY2thZ2VOYW1lfVwiLmApO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGFic29sdXRlIHBhdGggdG8gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSBpbiBgQGFuZ3VsYXIvYmF6ZWxgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGVtcGxhdGVEaXIocm9vdDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcm9vdCA9IG5vcm1hbGl6ZShyb290KTtcbiAgY29uc3QgcGFja2FnZUpzb24gPSByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL2JhemVsL3BhY2thZ2UuanNvbicsIHtcbiAgICBwYXRoczogW3Jvb3RdLFxuICB9KTtcbiAgY29uc3QgcGFja2FnZURpciA9IGRpcm5hbWUocGFja2FnZUpzb24pO1xuICBjb25zdCB0ZW1wbGF0ZURpciA9IGpvaW4ocGFja2FnZURpciwgJ3NyYycsICdidWlsZGVycycsICdmaWxlcycpO1xuICBpZiAoIXN0YXRTeW5jKHRlbXBsYXRlRGlyKS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBCYXplbCB0ZW1wbGF0ZSBkaXJlY3RvcnkgaW4gXCJAYW5ndWxhci9iYXplbFwiLicpO1xuICB9XG4gIHJldHVybiB0ZW1wbGF0ZURpcjtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBsaXN0IHRoZSBzcGVjaWZpZWQgJ2RpcicgdXNpbmcgZGVwdGgtZmlyc3QgYXBwcm9hY2guIFBhdGhzXG4gKiByZXR1cm5lZCBhcmUgcmVsYXRpdmUgdG8gJ2RpcicuXG4gKi9cbmZ1bmN0aW9uIGxpc3RSKGRpcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBmdW5jdGlvbiBsaXN0KGRpcjogc3RyaW5nLCByb290OiBzdHJpbmcsIHJlc3VsdHM6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgcGF0aHMgPSByZWFkZGlyU3luYyhkaXIpO1xuICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xuICAgICAgY29uc3QgYWJzUGF0aCA9IGpvaW4oZGlyLCBwYXRoKTtcbiAgICAgIGNvbnN0IHJlbFBhdGggPSBqb2luKHJvb3QsIHBhdGgpO1xuICAgICAgaWYgKHN0YXRTeW5jKGFic1BhdGgpLmlzRmlsZSgpKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChyZWxQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3QoYWJzUGF0aCwgcmVsUGF0aCwgcmVzdWx0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgcmV0dXJuIGxpc3QoZGlyLCAnJywgW10pO1xufVxuXG4vKipcbiAqIENvcHkgQmF6ZWwgZmlsZXMgKFdPUktTUEFDRSwgQlVJTEQuYmF6ZWwsIGV0YykgZnJvbSB0aGUgdGVtcGxhdGUgZGlyZWN0b3J5IHRvXG4gKiB0aGUgcHJvamVjdCBgcm9vdGAgZGlyZWN0b3J5LCBhbmQgcmV0dXJuIHRoZSBhYnNvbHV0ZSBwYXRocyBvZiB0aGUgZmlsZXNcbiAqIGNvcGllZCwgc28gdGhhdCB0aGV5IGNhbiBiZSBkZWxldGVkIGxhdGVyLlxuICogRXhpc3RpbmcgZmlsZXMgaW4gYHJvb3RgIHdpbGwgbm90IGJlIHJlcGxhY2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29weUJhemVsRmlsZXMocm9vdDogc3RyaW5nLCB0ZW1wbGF0ZURpcjogc3RyaW5nKSB7XG4gIHJvb3QgPSBub3JtYWxpemUocm9vdCk7XG4gIHRlbXBsYXRlRGlyID0gbm9ybWFsaXplKHRlbXBsYXRlRGlyKTtcbiAgY29uc3QgYmF6ZWxGaWxlczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgdGVtcGxhdGVzID0gbGlzdFIodGVtcGxhdGVEaXIpO1xuXG4gIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgdGVtcGxhdGVzKSB7XG4gICAgY29uc3QgbmFtZSA9IHRlbXBsYXRlLnJlcGxhY2UoJ19fZG90X18nLCAnLicpLnJlcGxhY2UoJy50ZW1wbGF0ZScsICcnKTtcbiAgICBjb25zdCBzb3VyY2UgPSBqb2luKHRlbXBsYXRlRGlyLCB0ZW1wbGF0ZSk7XG4gICAgY29uc3QgZGVzdCA9IGpvaW4ocm9vdCwgbmFtZSk7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghZXhpc3RzU3luYyhkZXN0KSkge1xuICAgICAgICBjb3B5RmlsZVN5bmMoc291cmNlLCBkZXN0KTtcbiAgICAgICAgYmF6ZWxGaWxlcy5wdXNoKGRlc3QpO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiYXplbEZpbGVzO1xufVxuXG4vKipcbiAqIERlbGV0ZSB0aGUgc3BlY2lmaWVkICdmaWxlcycuIFRoaXMgZnVuY3Rpb24gbmV2ZXIgdGhyb3dzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlQmF6ZWxGaWxlcyhmaWxlczogc3RyaW5nW10pIHtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgdHJ5IHtcbiAgICAgIHVubGlua1N5bmMoZmlsZSk7XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICB9XG59XG4iXX0=