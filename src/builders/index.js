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
        define("@angular/bazel/src/builders", ["require", "exports", "tslib", "rxjs", "@angular/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var rxjs_1 = require("rxjs");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    var BazelBuilder = /** @class */ (function () {
        function BazelBuilder(context) {
            this.context = context;
        }
        BazelBuilder.prototype.run = function (config) {
            var _this = this;
            var _a = this.context, host = _a.host, logger = _a.logger, workspace = _a.workspace;
            var root = workspace.root;
            var _b = config.options, bazelCommand = _b.bazelCommand, targetLabel = _b.targetLabel, watch = _b.watch;
            var executable = watch ? 'ibazel' : 'bazel';
            var binary = bazel_1.checkInstallation(executable, root);
            return rxjs_1.from(Promise.resolve().then(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var templateDir, bazelFiles, flags, err_1;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, bazel_1.getTemplateDir(host, root)];
                        case 1:
                            templateDir = _a.sent();
                            return [4 /*yield*/, bazel_1.copyBazelFiles(host, root, templateDir)];
                        case 2:
                            bazelFiles = _a.sent();
                            _a.label = 3;
                        case 3:
                            _a.trys.push([3, 5, 6, 8]);
                            flags = [];
                            return [4 /*yield*/, bazel_1.runBazel(root, binary, bazelCommand, targetLabel, flags)];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, { success: true }];
                        case 5:
                            err_1 = _a.sent();
                            logger.error(err_1.message);
                            return [2 /*return*/, { success: false }];
                        case 6: return [4 /*yield*/, bazel_1.deleteBazelFiles(host, bazelFiles)];
                        case 7:
                            _a.sent(); // this will never throw
                            return [7 /*endfinally*/];
                        case 8: return [2 /*return*/];
                    }
                });
            }); }));
        };
        return BazelBuilder;
    }());
    exports.default = BazelBuilder;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFJSCw2QkFBc0M7SUFDdEMsMkRBQXNHO0lBR3RHO1FBQ0Usc0JBQW9CLE9BQXVCO1lBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO1FBQUcsQ0FBQztRQUUvQywwQkFBRyxHQUFILFVBQUksTUFBNkM7WUFBakQsaUJBcUJDO1lBcEJPLElBQUEsaUJBQXdDLEVBQXZDLGNBQUksRUFBRSxrQkFBTSxFQUFFLHdCQUF5QixDQUFDO1lBQy9DLElBQU0sSUFBSSxHQUFTLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDNUIsSUFBQSxtQkFBNkQsRUFBNUQsOEJBQVksRUFBRSw0QkFBVyxFQUFFLGdCQUFpQyxDQUFDO1lBQ3BFLElBQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDOUMsSUFBTSxNQUFNLEdBQUcseUJBQWlCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBUyxDQUFDO1lBRTNELE9BQU8sV0FBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUM7Ozs7Z0NBQ2IscUJBQU0sc0JBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUE7OzRCQUE5QyxXQUFXLEdBQUcsU0FBZ0M7NEJBQ2pDLHFCQUFNLHNCQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsRUFBQTs7NEJBQTFELFVBQVUsR0FBRyxTQUE2Qzs7Ozs0QkFFeEQsS0FBSyxHQUFhLEVBQUUsQ0FBQzs0QkFDM0IscUJBQU0sZ0JBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQUE7OzRCQUE5RCxTQUE4RCxDQUFDOzRCQUMvRCxzQkFBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsRUFBQzs7OzRCQUV2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzs0QkFDMUIsc0JBQU8sRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLEVBQUM7Z0NBRXhCLHFCQUFNLHdCQUFnQixDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBQTs7NEJBQXhDLFNBQXdDLENBQUMsQ0FBRSx3QkFBd0I7Ozs7O2lCQUV0RSxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUM7UUFDSCxtQkFBQztJQUFELENBQUMsQUF6QkQsSUF5QkM7SUFFRCxrQkFBZSxZQUFZLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgQmF6ZWwgYnVpbGRlclxuICovXG5cbmltcG9ydCB7QnVpbGRFdmVudCwgQnVpbGRlciwgQnVpbGRlckNvbmZpZ3VyYXRpb24sIEJ1aWxkZXJDb250ZXh0fSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7UGF0aH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtPYnNlcnZhYmxlLCBmcm9tfSBmcm9tICdyeGpzJztcbmltcG9ydCB7Y2hlY2tJbnN0YWxsYXRpb24sIGNvcHlCYXplbEZpbGVzLCBkZWxldGVCYXplbEZpbGVzLCBnZXRUZW1wbGF0ZURpciwgcnVuQmF6ZWx9IGZyb20gJy4vYmF6ZWwnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuY2xhc3MgQmF6ZWxCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxTY2hlbWE+IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkge31cblxuICBydW4oY29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxQYXJ0aWFsPFNjaGVtYT4+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qge2hvc3QsIGxvZ2dlciwgd29ya3NwYWNlfSA9IHRoaXMuY29udGV4dDtcbiAgICBjb25zdCByb290OiBQYXRoID0gd29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3Qge2JhemVsQ29tbWFuZCwgdGFyZ2V0TGFiZWwsIHdhdGNofSA9IGNvbmZpZy5vcHRpb25zIGFzIFNjaGVtYTtcbiAgICBjb25zdCBleGVjdXRhYmxlID0gd2F0Y2ggPyAnaWJhemVsJyA6ICdiYXplbCc7XG4gICAgY29uc3QgYmluYXJ5ID0gY2hlY2tJbnN0YWxsYXRpb24oZXhlY3V0YWJsZSwgcm9vdCkgYXMgUGF0aDtcblxuICAgIHJldHVybiBmcm9tKFByb21pc2UucmVzb2x2ZSgpLnRoZW4oYXN5bmMoKSA9PiB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZURpciA9IGF3YWl0IGdldFRlbXBsYXRlRGlyKGhvc3QsIHJvb3QpO1xuICAgICAgY29uc3QgYmF6ZWxGaWxlcyA9IGF3YWl0IGNvcHlCYXplbEZpbGVzKGhvc3QsIHJvb3QsIHRlbXBsYXRlRGlyKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZsYWdzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBhd2FpdCBydW5CYXplbChyb290LCBiaW5hcnksIGJhemVsQ29tbWFuZCwgdGFyZ2V0TGFiZWwsIGZsYWdzKTtcbiAgICAgICAgcmV0dXJuIHtzdWNjZXNzOiB0cnVlfTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IGZhbHNlfTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGF3YWl0IGRlbGV0ZUJhemVsRmlsZXMoaG9zdCwgYmF6ZWxGaWxlcyk7ICAvLyB0aGlzIHdpbGwgbmV2ZXIgdGhyb3dcbiAgICAgIH1cbiAgICB9KSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQmF6ZWxCdWlsZGVyO1xuIl19