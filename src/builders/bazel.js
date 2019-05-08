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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBRTdCLCtDQUFvQztJQUNwQyx5QkFBK0U7SUFDL0UsNkJBQThDO0lBSzlDOztPQUVHO0lBQ0gsU0FBZ0IsUUFBUSxDQUNwQixVQUFrQixFQUFFLE1BQWMsRUFBRSxPQUFnQixFQUFFLGVBQXVCLEVBQzdFLEtBQWU7UUFDakIsVUFBVSxHQUFHLGdCQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkMsTUFBTSxHQUFHLGdCQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFDLE9BQU8sRUFBRSxNQUFNO1lBQ2pDLElBQU0sWUFBWSxHQUFHLHFCQUFLLENBQUMsTUFBTSxvQkFBRyxPQUFPLEVBQUUsZUFBZSxHQUFLLEtBQUssR0FBRztnQkFDdkUsR0FBRyxFQUFFLFVBQVU7Z0JBQ2YsS0FBSyxFQUFFLFNBQVM7YUFDakIsQ0FBQyxDQUFDO1lBRUgsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBQyxNQUFNO2dCQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRTtvQkFDeEIsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNwQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsNEJBQTBCLE1BQU0sTUFBRyxDQUFDLENBQUMsQ0FBQztpQkFDeEQ7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsSUFBWTtnQkFDdEMsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO29CQUNkLE9BQU8sRUFBRSxDQUFDO2lCQUNYO3FCQUFNO29CQUNMLE1BQU0sQ0FBQyxJQUFJ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IEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz0nbm9kZScvPlxuXG5pbXBvcnQge3NwYXdufSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7Y29weUZpbGVTeW5jLCBleGlzdHNTeW5jLCByZWFkZGlyU3luYywgc3RhdFN5bmMsIHVubGlua1N5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7ZGlybmFtZSwgam9pbiwgbm9ybWFsaXplfSBmcm9tICdwYXRoJztcblxuZXhwb3J0IHR5cGUgRXhlY3V0YWJsZSA9ICdiYXplbCcgfCAnaWJhemVsJztcbmV4cG9ydCB0eXBlIENvbW1hbmQgPSAnYnVpbGQnIHwgJ3Rlc3QnIHwgJ3J1bicgfCAnY292ZXJhZ2UnIHwgJ3F1ZXJ5JztcblxuLyoqXG4gKiBTcGF3biB0aGUgQmF6ZWwgcHJvY2Vzcy4gVHJhcCBTSU5HSU5UIHRvIG1ha2Ugc3VyZSBCYXplbCBwcm9jZXNzIGlzIGtpbGxlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJ1bkJhemVsKFxuICAgIHByb2plY3REaXI6IHN0cmluZywgYmluYXJ5OiBzdHJpbmcsIGNvbW1hbmQ6IENvbW1hbmQsIHdvcmtzcGFjZVRhcmdldDogc3RyaW5nLFxuICAgIGZsYWdzOiBzdHJpbmdbXSkge1xuICBwcm9qZWN0RGlyID0gbm9ybWFsaXplKHByb2plY3REaXIpO1xuICBiaW5hcnkgPSBub3JtYWxpemUoYmluYXJ5KTtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBidWlsZFByb2Nlc3MgPSBzcGF3bihiaW5hcnksIFtjb21tYW5kLCB3b3Jrc3BhY2VUYXJnZXQsIC4uLmZsYWdzXSwge1xuICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICB9KTtcblxuICAgIHByb2Nlc3Mub24oJ1NJR0lOVCcsIChzaWduYWwpID0+IHtcbiAgICAgIGlmICghYnVpbGRQcm9jZXNzLmtpbGxlZCkge1xuICAgICAgICBidWlsZFByb2Nlc3Mua2lsbCgpO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGBCYXplbCBwcm9jZXNzIHJlY2VpdmVkICR7c2lnbmFsfS5gKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBidWlsZFByb2Nlc3Mub25jZSgnY2xvc2UnLCAoY29kZTogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGAke2JpbmFyeX0gZmFpbGVkIHdpdGggY29kZSAke2NvZGV9LmApKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG5cbi8qKlxuICogUmVzb2x2ZXMgdGhlIHBhdGggdG8gYEBiYXplbC9iYXplbGAgb3IgYEBiYXplbC9pYmF6ZWxgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tJbnN0YWxsYXRpb24obmFtZTogRXhlY3V0YWJsZSwgcHJvamVjdERpcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcHJvamVjdERpciA9IG5vcm1hbGl6ZShwcm9qZWN0RGlyKTtcbiAgY29uc3QgcGFja2FnZU5hbWUgPSBgQGJhemVsLyR7bmFtZX1gO1xuICB0cnkge1xuICAgIGNvbnN0IGJhemVsUGF0aCA9IHJlcXVpcmUucmVzb2x2ZShwYWNrYWdlTmFtZSwge1xuICAgICAgcGF0aHM6IFtwcm9qZWN0RGlyXSxcbiAgICB9KTtcbiAgICByZXR1cm4gcmVxdWlyZShiYXplbFBhdGgpLmdldE5hdGl2ZUJpbmFyeSgpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5jb2RlID09PSAnTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQ291bGQgbm90IHJ1biAke25hbWV9LiBQbGVhc2UgbWFrZSBzdXJlIHRoYXQgdGhlIGAgK1xuICAgICAgICAgIGBcIiR7bmFtZX1cIiBjb21tYW5kIGlzIGluc3RhbGxlZCBieSBydW5uaW5nIGAgK1xuICAgICAgICAgIGBcIm5wbSBpbnN0YWxsICR7cGFja2FnZU5hbWV9XCIgb3IgXCJ5YXJuIGluc3RhbGwgJHtwYWNrYWdlTmFtZX1cIi5gKTtcbiAgICB9XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSB0ZW1wbGF0ZSBkaXJlY3RvcnkgaW4gYEBhbmd1bGFyL2JhemVsYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRlbXBsYXRlRGlyKHJvb3Q6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJvb3QgPSBub3JtYWxpemUocm9vdCk7XG4gIGNvbnN0IHBhY2thZ2VKc29uID0gcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9iYXplbC9wYWNrYWdlLmpzb24nLCB7XG4gICAgcGF0aHM6IFtyb290XSxcbiAgfSk7XG4gIGNvbnN0IHBhY2thZ2VEaXIgPSBkaXJuYW1lKHBhY2thZ2VKc29uKTtcbiAgY29uc3QgdGVtcGxhdGVEaXIgPSBqb2luKHBhY2thZ2VEaXIsICdzcmMnLCAnYnVpbGRlcnMnLCAnZmlsZXMnKTtcbiAgaWYgKCFzdGF0U3luYyh0ZW1wbGF0ZURpcikuaXNEaXJlY3RvcnkoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgQmF6ZWwgdGVtcGxhdGUgZGlyZWN0b3J5IGluIFwiQGFuZ3VsYXIvYmF6ZWxcIi4nKTtcbiAgfVxuICByZXR1cm4gdGVtcGxhdGVEaXI7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgbGlzdCB0aGUgc3BlY2lmaWVkICdkaXInIHVzaW5nIGRlcHRoLWZpcnN0IGFwcHJvYWNoLiBQYXRoc1xuICogcmV0dXJuZWQgYXJlIHJlbGF0aXZlIHRvICdkaXInLlxuICovXG5mdW5jdGlvbiBsaXN0UihkaXI6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgZnVuY3Rpb24gbGlzdChkaXI6IHN0cmluZywgcm9vdDogc3RyaW5nLCByZXN1bHRzOiBzdHJpbmdbXSkge1xuICAgIGNvbnN0IHBhdGhzID0gcmVhZGRpclN5bmMoZGlyKTtcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHMpIHtcbiAgICAgIGNvbnN0IGFic1BhdGggPSBqb2luKGRpciwgcGF0aCk7XG4gICAgICBjb25zdCByZWxQYXRoID0gam9pbihyb290LCBwYXRoKTtcbiAgICAgIGlmIChzdGF0U3luYyhhYnNQYXRoKS5pc0ZpbGUoKSkge1xuICAgICAgICByZXN1bHRzLnB1c2gocmVsUGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0KGFic1BhdGgsIHJlbFBhdGgsIHJlc3VsdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIHJldHVybiBsaXN0KGRpciwgJycsIFtdKTtcbn1cblxuLyoqXG4gKiBDb3B5IEJhemVsIGZpbGVzIChXT1JLU1BBQ0UsIEJVSUxELmJhemVsLCBldGMpIGZyb20gdGhlIHRlbXBsYXRlIGRpcmVjdG9yeSB0b1xuICogdGhlIHByb2plY3QgYHJvb3RgIGRpcmVjdG9yeSwgYW5kIHJldHVybiB0aGUgYWJzb2x1dGUgcGF0aHMgb2YgdGhlIGZpbGVzXG4gKiBjb3BpZWQsIHNvIHRoYXQgdGhleSBjYW4gYmUgZGVsZXRlZCBsYXRlci5cbiAqIEV4aXN0aW5nIGZpbGVzIGluIGByb290YCB3aWxsIG5vdCBiZSByZXBsYWNlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvcHlCYXplbEZpbGVzKHJvb3Q6IHN0cmluZywgdGVtcGxhdGVEaXI6IHN0cmluZykge1xuICByb290ID0gbm9ybWFsaXplKHJvb3QpO1xuICB0ZW1wbGF0ZURpciA9IG5vcm1hbGl6ZSh0ZW1wbGF0ZURpcik7XG4gIGNvbnN0IGJhemVsRmlsZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHRlbXBsYXRlcyA9IGxpc3RSKHRlbXBsYXRlRGlyKTtcblxuICBmb3IgKGNvbnN0IHRlbXBsYXRlIG9mIHRlbXBsYXRlcykge1xuICAgIGNvbnN0IG5hbWUgPSB0ZW1wbGF0ZS5yZXBsYWNlKCdfX2RvdF9fJywgJy4nKS5yZXBsYWNlKCcudGVtcGxhdGUnLCAnJyk7XG4gICAgY29uc3Qgc291cmNlID0gam9pbih0ZW1wbGF0ZURpciwgdGVtcGxhdGUpO1xuICAgIGNvbnN0IGRlc3QgPSBqb2luKHJvb3QsIG5hbWUpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWV4aXN0c1N5bmMoZGVzdCkpIHtcbiAgICAgICAgY29weUZpbGVTeW5jKHNvdXJjZSwgZGVzdCk7XG4gICAgICAgIGJhemVsRmlsZXMucHVzaChkZXN0KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmF6ZWxGaWxlcztcbn1cblxuLyoqXG4gKiBEZWxldGUgdGhlIHNwZWNpZmllZCAnZmlsZXMnLiBUaGlzIGZ1bmN0aW9uIG5ldmVyIHRocm93cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZUJhemVsRmlsZXMoZmlsZXM6IHN0cmluZ1tdKSB7XG4gIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgIHRyeSB7XG4gICAgICB1bmxpbmtTeW5jKGZpbGUpO1xuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgfVxufVxuIl19