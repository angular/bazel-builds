/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel builder
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel/src/builders", ["require", "exports", "tslib", "@angular-devkit/architect", "@angular/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var architect_1 = require("@angular-devkit/architect");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    function _bazelBuilder(options, context) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var logger, workspaceRoot, bazelCommand, leaveBazelFilesOnDisk, targetLabel, watch, executable, binary, templateDir, bazelFiles, flags, err_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger = context.logger, workspaceRoot = context.workspaceRoot;
                        bazelCommand = options.bazelCommand, leaveBazelFilesOnDisk = options.leaveBazelFilesOnDisk, targetLabel = options.targetLabel, watch = options.watch;
                        executable = watch ? 'ibazel' : 'bazel';
                        binary = bazel_1.checkInstallation(executable, workspaceRoot);
                        templateDir = bazel_1.getTemplateDir(workspaceRoot);
                        bazelFiles = bazel_1.copyBazelFiles(workspaceRoot, templateDir);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        flags = [];
                        return [4 /*yield*/, bazel_1.runBazel(workspaceRoot, binary, bazelCommand, targetLabel, flags)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { success: true }];
                    case 3:
                        err_1 = _a.sent();
                        logger.error(err_1.message);
                        return [2 /*return*/, { success: false }];
                    case 4:
                        if (!leaveBazelFilesOnDisk) {
                            bazel_1.deleteBazelFiles(bazelFiles); // this will never throw
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    exports.default = architect_1.createBuilder(_bazelBuilder);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx1REFBd0Y7SUFFeEYsMkRBQXNHO0lBR3RHLFNBQWUsYUFBYSxDQUN4QixPQUEwQixFQUMxQixPQUF1Qjs7Ozs7O3dCQUVsQixNQUFNLEdBQW1CLE9BQU8sT0FBMUIsRUFBRSxhQUFhLEdBQUksT0FBTyxjQUFYLENBQVk7d0JBQ2pDLFlBQVksR0FBK0MsT0FBTyxhQUF0RCxFQUFFLHFCQUFxQixHQUF3QixPQUFPLHNCQUEvQixFQUFFLFdBQVcsR0FBVyxPQUFPLFlBQWxCLEVBQUUsS0FBSyxHQUFJLE9BQU8sTUFBWCxDQUFZO3dCQUNwRSxVQUFVLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQzt3QkFDeEMsTUFBTSxHQUFHLHlCQUFpQixDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQzt3QkFDdEQsV0FBVyxHQUFHLHNCQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQzVDLFVBQVUsR0FBRyxzQkFBYyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQzs7Ozt3QkFHdEQsS0FBSyxHQUFhLEVBQUUsQ0FBQzt3QkFDM0IscUJBQU0sZ0JBQVEsQ0FBQyxhQUFhLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQUE7O3dCQUF2RSxTQUF1RSxDQUFDO3dCQUN4RSxzQkFBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsRUFBQzs7O3dCQUV2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDMUIsc0JBQU8sRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLEVBQUM7O3dCQUV4QixJQUFJLENBQUMscUJBQXFCLEVBQUU7NEJBQzFCLHdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUUsd0JBQXdCO3lCQUN4RDs7Ozs7O0tBRUo7SUFFRCxrQkFBZSx5QkFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEJhemVsIGJ1aWxkZXJcbiAqL1xuXG5pbXBvcnQge0J1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyLH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge0pzb25PYmplY3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7Y2hlY2tJbnN0YWxsYXRpb24sIGNvcHlCYXplbEZpbGVzLCBkZWxldGVCYXplbEZpbGVzLCBnZXRUZW1wbGF0ZURpciwgcnVuQmF6ZWx9IGZyb20gJy4vYmF6ZWwnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuYXN5bmMgZnVuY3Rpb24gX2JhemVsQnVpbGRlcihcbiAgICBvcHRpb25zOiBKc29uT2JqZWN0JlNjaGVtYSxcbiAgICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgICApOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qge2xvZ2dlciwgd29ya3NwYWNlUm9vdH0gPSBjb250ZXh0O1xuICBjb25zdCB7YmF6ZWxDb21tYW5kLCBsZWF2ZUJhemVsRmlsZXNPbkRpc2ssIHRhcmdldExhYmVsLCB3YXRjaH0gPSBvcHRpb25zO1xuICBjb25zdCBleGVjdXRhYmxlID0gd2F0Y2ggPyAnaWJhemVsJyA6ICdiYXplbCc7XG4gIGNvbnN0IGJpbmFyeSA9IGNoZWNrSW5zdGFsbGF0aW9uKGV4ZWN1dGFibGUsIHdvcmtzcGFjZVJvb3QpO1xuICBjb25zdCB0ZW1wbGF0ZURpciA9IGdldFRlbXBsYXRlRGlyKHdvcmtzcGFjZVJvb3QpO1xuICBjb25zdCBiYXplbEZpbGVzID0gY29weUJhemVsRmlsZXMod29ya3NwYWNlUm9vdCwgdGVtcGxhdGVEaXIpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgZmxhZ3M6IHN0cmluZ1tdID0gW107XG4gICAgYXdhaXQgcnVuQmF6ZWwod29ya3NwYWNlUm9vdCwgYmluYXJ5LCBiYXplbENvbW1hbmQsIHRhcmdldExhYmVsLCBmbGFncyk7XG4gICAgcmV0dXJuIHtzdWNjZXNzOiB0cnVlfTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbG9nZ2VyLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICByZXR1cm4ge3N1Y2Nlc3M6IGZhbHNlfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoIWxlYXZlQmF6ZWxGaWxlc09uRGlzaykge1xuICAgICAgZGVsZXRlQmF6ZWxGaWxlcyhiYXplbEZpbGVzKTsgIC8vIHRoaXMgd2lsbCBuZXZlciB0aHJvd1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKF9iYXplbEJ1aWxkZXIpO1xuIl19