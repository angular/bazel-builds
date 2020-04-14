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
        define("@angular/bazel/src/builders/bazel", ["require", "exports", "tslib", "child_process", "fs", "os", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types='node'/>
    var child_process_1 = require("child_process");
    var fs_1 = require("fs");
    var os_1 = require("os");
    var path_1 = require("path");
    /**
     * Spawn the Bazel process. Trap SINGINT to make sure Bazel process is killed.
     */
    function runBazel(projectDir, binary, command, workspaceTarget, flags) {
        projectDir = path_1.normalize(projectDir);
        binary = path_1.normalize(binary);
        return new Promise(function (resolve, reject) {
            var buildProcess = child_process_1.spawn(binary, tslib_1.__spread([command, workspaceTarget], flags), {
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
        var packageName = "@bazel/" + name;
        try {
            var bazelPath = require.resolve(packageName, {
                paths: [projectDir],
            });
            return require(bazelPath).getNativeBinary();
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
     * Return the name of the lock file that is present in the specified 'root'
     * directory. If none exists, default to creating an empty yarn.lock file.
     */
    function getOrCreateLockFile(root) {
        var yarnLock = path_1.join(root, 'yarn.lock');
        if (fs_1.existsSync(yarnLock)) {
            return 'yarn.lock';
        }
        var npmLock = path_1.join(root, 'package-lock.json');
        if (fs_1.existsSync(npmLock)) {
            return 'package-lock.json';
        }
        // Prefer yarn if no lock file exists
        fs_1.writeFileSync(yarnLock, '');
        return 'yarn.lock';
    }
    // Replace yarn_install rule with npm_install and copy from 'source' to 'dest'.
    function replaceYarnWithNpm(source, dest) {
        var srcContent = fs_1.readFileSync(source, 'utf-8');
        var destContent = srcContent.replace(/yarn_install/g, 'npm_install')
            .replace('yarn_lock', 'package_lock_json')
            .replace('yarn.lock', 'package-lock.json');
        fs_1.writeFileSync(dest, destContent);
    }
    /**
     * Disable sandbox on Mac OS by setting spawn_strategy in .bazelrc.
     * For a hello world (ng new) application, removing the sandbox improves build
     * time by almost 40%.
     * ng build with sandbox: 22.0 seconds
     * ng build without sandbox: 13.3 seconds
     */
    function disableSandbox(source, dest) {
        var srcContent = fs_1.readFileSync(source, 'utf-8');
        var destContent = srcContent + "\n# Disable sandbox on Mac OS for performance reason.\nbuild --spawn_strategy=local\nrun --spawn_strategy=local\ntest --spawn_strategy=local\n";
        fs_1.writeFileSync(dest, destContent);
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
        var useYarn = getOrCreateLockFile(root) === 'yarn.lock';
        try {
            for (var templates_1 = tslib_1.__values(templates), templates_1_1 = templates_1.next(); !templates_1_1.done; templates_1_1 = templates_1.next()) {
                var template = templates_1_1.value;
                var name_1 = template.replace('__dot__', '.').replace('.template', '');
                var source = path_1.join(templateDir, template);
                var dest = path_1.join(root, name_1);
                try {
                    if (!fs_1.existsSync(dest)) {
                        if (!useYarn && name_1 === 'WORKSPACE') {
                            replaceYarnWithNpm(source, dest);
                        }
                        else if (os_1.platform() === 'darwin' && name_1 === '.bazelrc') {
                            disableSandbox(source, dest);
                        }
                        else {
                            fs_1.copyFileSync(source, dest);
                        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBRTdCLCtDQUFvQztJQUNwQyx5QkFBNEc7SUFDNUcseUJBQTRCO0lBQzVCLDZCQUE4QztJQUs5Qzs7T0FFRztJQUNILFNBQWdCLFFBQVEsQ0FDcEIsVUFBa0IsRUFBRSxNQUFjLEVBQUUsT0FBZ0IsRUFBRSxlQUF1QixFQUM3RSxLQUFlO1FBQ2pCLFVBQVUsR0FBRyxnQkFBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25DLE1BQU0sR0FBRyxnQkFBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNCLE9BQU8sSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtZQUNqQyxJQUFNLFlBQVksR0FBRyxxQkFBSyxDQUFDLE1BQU0sb0JBQUcsT0FBTyxFQUFFLGVBQWUsR0FBSyxLQUFLLEdBQUc7Z0JBQ3ZFLEdBQUcsRUFBRSxVQUFVO2dCQUNmLEtBQUssRUFBRSxTQUFTO2FBQ2pCLENBQUMsQ0FBQztZQUVILE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQUMsTUFBTTtnQkFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7b0JBQ3hCLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDcEIsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLDRCQUEwQixNQUFNLE1BQUcsQ0FBQyxDQUFDLENBQUM7aUJBQ3hEO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFDLElBQVk7Z0JBQ3RDLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtvQkFDZCxPQUFPLEVBQUUsQ0FBQztpQkFDWDtxQkFBTTtvQkFDTCxN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Z0IsQ0FBQyxLQUFlOzs7WUFDOUMsS0FBbUIsSUFBQSxVQUFBLGlCQUFBLEtBQUssQ0FBQSw0QkFBQSwrQ0FBRTtnQkFBckIsSUFBTSxJQUFJLGtCQUFBO2dCQUNiLElBQUk7b0JBQ0YsZUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUNsQjtnQkFBQyxXQUFNO2lCQUNQO2FBQ0Y7Ozs7Ozs7OztJQUNILENBQUM7SUFQRCw0Q0FPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9J25vZGUnLz5cblxuaW1wb3J0IHtzcGF3bn0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQge2NvcHlGaWxlU3luYywgZXhpc3RzU3luYywgcmVhZGRpclN5bmMsIHJlYWRGaWxlU3luYywgc3RhdFN5bmMsIHVubGlua1N5bmMsIHdyaXRlRmlsZVN5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7cGxhdGZvcm19IGZyb20gJ29zJztcbmltcG9ydCB7ZGlybmFtZSwgam9pbiwgbm9ybWFsaXplfSBmcm9tICdwYXRoJztcblxuZXhwb3J0IHR5cGUgRXhlY3V0YWJsZSA9ICdiYXplbCd8J2liYXplbCc7XG5leHBvcnQgdHlwZSBDb21tYW5kID0gJ2J1aWxkJ3wndGVzdCd8J3J1bid8J2NvdmVyYWdlJ3wncXVlcnknO1xuXG4vKipcbiAqIFNwYXduIHRoZSBCYXplbCBwcm9jZXNzLiBUcmFwIFNJTkdJTlQgdG8gbWFrZSBzdXJlIEJhemVsIHByb2Nlc3MgaXMga2lsbGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcnVuQmF6ZWwoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLCBiaW5hcnk6IHN0cmluZywgY29tbWFuZDogQ29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0OiBzdHJpbmcsXG4gICAgZmxhZ3M6IHN0cmluZ1tdKSB7XG4gIHByb2plY3REaXIgPSBub3JtYWxpemUocHJvamVjdERpcik7XG4gIGJpbmFyeSA9IG5vcm1hbGl6ZShiaW5hcnkpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGJ1aWxkUHJvY2VzcyA9IHNwYXduKGJpbmFyeSwgW2NvbW1hbmQsIHdvcmtzcGFjZVRhcmdldCwgLi4uZmxhZ3NdLCB7XG4gICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICBzdGRpbzogJ2luaGVyaXQnLFxuICAgIH0pO1xuXG4gICAgcHJvY2Vzcy5vbignU0lHSU5UJywgKHNpZ25hbCkgPT4ge1xuICAgICAgaWYgKCFidWlsZFByb2Nlc3Mua2lsbGVkKSB7XG4gICAgICAgIGJ1aWxkUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYEJhemVsIHByb2Nlc3MgcmVjZWl2ZWQgJHtzaWduYWx9LmApKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGJ1aWxkUHJvY2Vzcy5vbmNlKCdjbG9zZScsIChjb2RlOiBudW1iZXIpID0+IHtcbiAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYCR7YmluYXJ5fSBmYWlsZWQgd2l0aCBjb2RlICR7Y29kZX0uYCkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlcyB0aGUgcGF0aCB0byBgQGJhemVsL2JhemVsYCBvciBgQGJhemVsL2liYXplbGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0luc3RhbGxhdGlvbihuYW1lOiBFeGVjdXRhYmxlLCBwcm9qZWN0RGlyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBwcm9qZWN0RGlyID0gbm9ybWFsaXplKHByb2plY3REaXIpO1xuICBjb25zdCBwYWNrYWdlTmFtZSA9IGBAYmF6ZWwvJHtuYW1lfWA7XG4gIHRyeSB7XG4gICAgY29uc3QgYmF6ZWxQYXRoID0gcmVxdWlyZS5yZXNvbHZlKHBhY2thZ2VOYW1lLCB7XG4gICAgICBwYXRoczogW3Byb2plY3REaXJdLFxuICAgIH0pO1xuICAgIHJldHVybiByZXF1aXJlKGJhemVsUGF0aCkuZ2V0TmF0aXZlQmluYXJ5KCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDb3VsZCBub3QgcnVuICR7bmFtZX0uIFBsZWFzZSBtYWtlIHN1cmUgdGhhdCB0aGUgYCArXG4gICAgICAgICAgYFwiJHtuYW1lfVwiIGNvbW1hbmQgaXMgaW5zdGFsbGVkIGJ5IHJ1bm5pbmcgYCArXG4gICAgICAgICAgYFwibnBtIGluc3RhbGwgJHtwYWNrYWdlTmFtZX1cIiBvciBcInlhcm4gaW5zdGFsbCAke3BhY2thZ2VOYW1lfVwiLmApO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGFic29sdXRlIHBhdGggdG8gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSBpbiBgQGFuZ3VsYXIvYmF6ZWxgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGVtcGxhdGVEaXIocm9vdDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcm9vdCA9IG5vcm1hbGl6ZShyb290KTtcbiAgY29uc3QgcGFja2FnZUpzb24gPSByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL2JhemVsL3BhY2thZ2UuanNvbicsIHtcbiAgICBwYXRoczogW3Jvb3RdLFxuICB9KTtcbiAgY29uc3QgcGFja2FnZURpciA9IGRpcm5hbWUocGFja2FnZUpzb24pO1xuICBjb25zdCB0ZW1wbGF0ZURpciA9IGpvaW4ocGFja2FnZURpciwgJ3NyYycsICdidWlsZGVycycsICdmaWxlcycpO1xuICBpZiAoIXN0YXRTeW5jKHRlbXBsYXRlRGlyKS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBCYXplbCB0ZW1wbGF0ZSBkaXJlY3RvcnkgaW4gXCJAYW5ndWxhci9iYXplbFwiLicpO1xuICB9XG4gIHJldHVybiB0ZW1wbGF0ZURpcjtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBsaXN0IHRoZSBzcGVjaWZpZWQgJ2RpcicgdXNpbmcgZGVwdGgtZmlyc3QgYXBwcm9hY2guIFBhdGhzXG4gKiByZXR1cm5lZCBhcmUgcmVsYXRpdmUgdG8gJ2RpcicuXG4gKi9cbmZ1bmN0aW9uIGxpc3RSKGRpcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBmdW5jdGlvbiBsaXN0KGRpcjogc3RyaW5nLCByb290OiBzdHJpbmcsIHJlc3VsdHM6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgcGF0aHMgPSByZWFkZGlyU3luYyhkaXIpO1xuICAgIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xuICAgICAgY29uc3QgYWJzUGF0aCA9IGpvaW4oZGlyLCBwYXRoKTtcbiAgICAgIGNvbnN0IHJlbFBhdGggPSBqb2luKHJvb3QsIHBhdGgpO1xuICAgICAgaWYgKHN0YXRTeW5jKGFic1BhdGgpLmlzRmlsZSgpKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChyZWxQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpc3QoYWJzUGF0aCwgcmVsUGF0aCwgcmVzdWx0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgcmV0dXJuIGxpc3QoZGlyLCAnJywgW10pO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgbmFtZSBvZiB0aGUgbG9jayBmaWxlIHRoYXQgaXMgcHJlc2VudCBpbiB0aGUgc3BlY2lmaWVkICdyb290J1xuICogZGlyZWN0b3J5LiBJZiBub25lIGV4aXN0cywgZGVmYXVsdCB0byBjcmVhdGluZyBhbiBlbXB0eSB5YXJuLmxvY2sgZmlsZS5cbiAqL1xuZnVuY3Rpb24gZ2V0T3JDcmVhdGVMb2NrRmlsZShyb290OiBzdHJpbmcpOiAneWFybi5sb2NrJ3wncGFja2FnZS1sb2NrLmpzb24nIHtcbiAgY29uc3QgeWFybkxvY2sgPSBqb2luKHJvb3QsICd5YXJuLmxvY2snKTtcbiAgaWYgKGV4aXN0c1N5bmMoeWFybkxvY2spKSB7XG4gICAgcmV0dXJuICd5YXJuLmxvY2snO1xuICB9XG4gIGNvbnN0IG5wbUxvY2sgPSBqb2luKHJvb3QsICdwYWNrYWdlLWxvY2suanNvbicpO1xuICBpZiAoZXhpc3RzU3luYyhucG1Mb2NrKSkge1xuICAgIHJldHVybiAncGFja2FnZS1sb2NrLmpzb24nO1xuICB9XG4gIC8vIFByZWZlciB5YXJuIGlmIG5vIGxvY2sgZmlsZSBleGlzdHNcbiAgd3JpdGVGaWxlU3luYyh5YXJuTG9jaywgJycpO1xuICByZXR1cm4gJ3lhcm4ubG9jayc7XG59XG5cbi8vIFJlcGxhY2UgeWFybl9pbnN0YWxsIHJ1bGUgd2l0aCBucG1faW5zdGFsbCBhbmQgY29weSBmcm9tICdzb3VyY2UnIHRvICdkZXN0Jy5cbmZ1bmN0aW9uIHJlcGxhY2VZYXJuV2l0aE5wbShzb3VyY2U6IHN0cmluZywgZGVzdDogc3RyaW5nKSB7XG4gIGNvbnN0IHNyY0NvbnRlbnQgPSByZWFkRmlsZVN5bmMoc291cmNlLCAndXRmLTgnKTtcbiAgY29uc3QgZGVzdENvbnRlbnQgPSBzcmNDb250ZW50LnJlcGxhY2UoL3lhcm5faW5zdGFsbC9nLCAnbnBtX2luc3RhbGwnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgneWFybl9sb2NrJywgJ3BhY2thZ2VfbG9ja19qc29uJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoJ3lhcm4ubG9jaycsICdwYWNrYWdlLWxvY2suanNvbicpO1xuICB3cml0ZUZpbGVTeW5jKGRlc3QsIGRlc3RDb250ZW50KTtcbn1cblxuLyoqXG4gKiBEaXNhYmxlIHNhbmRib3ggb24gTWFjIE9TIGJ5IHNldHRpbmcgc3Bhd25fc3RyYXRlZ3kgaW4gLmJhemVscmMuXG4gKiBGb3IgYSBoZWxsbyB3b3JsZCAobmcgbmV3KSBhcHBsaWNhdGlvbiwgcmVtb3ZpbmcgdGhlIHNhbmRib3ggaW1wcm92ZXMgYnVpbGRcbiAqIHRpbWUgYnkgYWxtb3N0IDQwJS5cbiAqIG5nIGJ1aWxkIHdpdGggc2FuZGJveDogMjIuMCBzZWNvbmRzXG4gKiBuZyBidWlsZCB3aXRob3V0IHNhbmRib3g6IDEzLjMgc2Vjb25kc1xuICovXG5mdW5jdGlvbiBkaXNhYmxlU2FuZGJveChzb3VyY2U6IHN0cmluZywgZGVzdDogc3RyaW5nKSB7XG4gIGNvbnN0IHNyY0NvbnRlbnQgPSByZWFkRmlsZVN5bmMoc291cmNlLCAndXRmLTgnKTtcbiAgY29uc3QgZGVzdENvbnRlbnQgPSBgJHtzcmNDb250ZW50fVxuIyBEaXNhYmxlIHNhbmRib3ggb24gTWFjIE9TIGZvciBwZXJmb3JtYW5jZSByZWFzb24uXG5idWlsZCAtLXNwYXduX3N0cmF0ZWd5PWxvY2FsXG5ydW4gLS1zcGF3bl9zdHJhdGVneT1sb2NhbFxudGVzdCAtLXNwYXduX3N0cmF0ZWd5PWxvY2FsXG5gO1xuICB3cml0ZUZpbGVTeW5jKGRlc3QsIGRlc3RDb250ZW50KTtcbn1cblxuLyoqXG4gKiBDb3B5IEJhemVsIGZpbGVzIChXT1JLU1BBQ0UsIEJVSUxELmJhemVsLCBldGMpIGZyb20gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSB0b1xuICogdGhlIHByb2plY3QgYHJvb3RgIGRpcmVjdG9yeSwgYW5kIHJldHVybiB0aGUgYWJzb2x1dGUgcGF0aHMgb2YgdGhlIGZpbGVzXG4gKiBjb3BpZWQsIHNvIHRoYXQgdGhleSBjYW4gYmUgZGVsZXRlZCBsYXRlci5cbiAqIEV4aXN0aW5nIGZpbGVzIGluIGByb290YCB3aWxsIG5vdCBiZSByZXBsYWNlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvcHlCYXplbEZpbGVzKHJvb3Q6IHN0cmluZywgdGVtcGxhdGVEaXI6IHN0cmluZykge1xuICByb290ID0gbm9ybWFsaXplKHJvb3QpO1xuICB0ZW1wbGF0ZURpciA9IG5vcm1hbGl6ZSh0ZW1wbGF0ZURpcik7XG4gIGNvbnN0IGJhemVsRmlsZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGxpc3RSKHRlbXBsYXRlRGlyKTtcbiAgY29uc3QgdXNlWWFybiA9IGdldE9yQ3JlYXRlTG9ja0ZpbGUocm9vdCkgPT09ICd5YXJuLmxvY2snO1xuXG4gIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgdGVtcGxhdGVzKSB7XG4gICAgY29uc3QgbmFtZSA9IHRlbXBsYXRlLnJlcGxhY2UoJ19fZG90X18nLCAnLicpLnJlcGxhY2UoJy50ZW1wbGF0ZScsICcnKTtcbiAgICBjb25zdCBzb3VyY2UgPSBqb2luKHRlbXBsYXRlRGlyLCB0ZW1wbGF0ZSk7XG4gICAgY29uc3QgZGVzdCA9IGpvaW4ocm9vdCwgbmFtZSk7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghZXhpc3RzU3luYyhkZXN0KSkge1xuICAgICAgICBpZiAoIXVzZVlhcm4gJiYgbmFtZSA9PT0gJ1dPUktTUEFDRScpIHtcbiAgICAgICAgICByZXBsYWNlWWFybldpdGhOcG0oc291cmNlLCBkZXN0KTtcbiAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSgpID09PSAnZGFyd2luJyAmJiBuYW1lID09PSAnLmJhemVscmMnKSB7XG4gICAgICAgICAgZGlzYWJsZVNhbmRib3goc291cmNlLCBkZXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb3B5RmlsZVN5bmMoc291cmNlLCBkZXN0KTtcbiAgICAgICAgfVxuICAgICAgICBiYXplbEZpbGVzLnB1c2goZGVzdCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJhemVsRmlsZXM7XG59XG5cbi8qKlxuICogRGVsZXRlIHRoZSBzcGVjaWZpZWQgJ2ZpbGVzJy4gVGhpcyBmdW5jdGlvbiBuZXZlciB0aHJvd3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWxldGVCYXplbEZpbGVzKGZpbGVzOiBzdHJpbmdbXSkge1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICB0cnkge1xuICAgICAgdW5saW5rU3luYyhmaWxlKTtcbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH1cbn1cbiJdfQ==