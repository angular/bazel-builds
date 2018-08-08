# Copyright Google Inc. All Rights Reserved.
#
# Use of this source code is governed by an MIT-style license that can be
# found in the LICENSE file at https://angular.io/license

"Install toolchain dependencies"

load("@build_bazel_rules_nodejs//:defs.bzl", "yarn_install")

def ng_setup_workspace():
  """This repository rule should be called from your WORKSPACE file.

  It creates some additional Bazel external repositories that are used internally
  by the Angular rules.
  """
  yarn_install(
      name = "angular_packager_deps",
      package_json = "@angular//src/ng_package:package.json",
      yarn_lock = "@angular//src/ng_package:yarn.lock",
  )
