# Copyright Google LLC All Rights Reserved.
#
# Use of this source code is governed by an MIT-style license that can be
# found in the LICENSE file at https://angular.io/license
"""Run Angular's AOT template compiler
"""

load("//@angular/bazel/src/ng_module:partial_compilation.bzl", "NgPartialCompilationInfo")
load(
    "//@angular/bazel/src:external.bzl",
    "COMMON_ATTRIBUTES",
    "COMMON_OUTPUTS",
    "DEFAULT_API_EXTRACTOR",
    "DEFAULT_NG_COMPILER",
    "DEFAULT_NG_XI18N",
    "DEPS_ASPECTS",
    "LinkablePackageInfo",
    "NpmPackageInfo",
    "TsConfigInfo",
    "compile_ts",
    "js_ecma_script_module_info",
    "js_module_info",
    "js_named_module_info",
    "node_modules_aspect",
    "ts_providers_dict_to_struct",
    "tsc_wrapped_tsconfig",
)

# enable_perf_logging controls whether Ivy's performance tracing system will be enabled for any
# compilation which includes this provider.
NgPerfInfo = provider(fields = ["enable_perf_logging"])

_FLAT_DTS_FILE_SUFFIX = ".bundle.d.ts"

def is_perf_requested(ctx):
    return ctx.attr.perf_flag != None and ctx.attr.perf_flag[NgPerfInfo].enable_perf_logging == True

def _is_partial_compilation_enabled(ctx):
    """Whether partial compilation is enabled for this target."""
    return ctx.attr._partial_compilation_flag[NgPartialCompilationInfo].enabled

def _get_ivy_compilation_mode(ctx):
    """Gets the Ivy compilation mode based on the current build settings."""
    return "partial" if _is_partial_compilation_enabled(ctx) else "full"

def _basename_of(ctx, file):
    ext_len = len(".ts")
    if file.short_path.endswith(".ng.html"):
        ext_len = len(".ng.html")
    elif file.short_path.endswith(".html"):
        ext_len = len(".html")
    return file.short_path[len(ctx.label.package) + 1:-ext_len]

# Return true if run with bazel (the open-sourced version of blaze), false if
# run with blaze.
def _is_bazel():
    return not hasattr(native, "genmpm")

def _flat_module_out_file(ctx):
    """Provide a default for the flat_module_out_file attribute.

    We cannot use the default="" parameter of ctx.attr because the value is calculated
    from other attributes (name)

    Args:
      ctx: skylark rule execution context

    Returns:
      a basename used for the flat module out (no extension)
    """
    if getattr(ctx.attr, "flat_module_out_file", False):
        return ctx.attr.flat_module_out_file
    return "%s_public_index" % ctx.label.name

def _should_produce_dts_bundle(ctx):
    """Should we produce dts bundles.

    We only produce flatten dts outs when we expect the ng_module is meant to be published,
    based on the value of the bundle_dts attribute.

    Args:
      ctx: skylark rule execution context

    Returns:
      true when we should produce bundled dts.
    """
    return getattr(ctx.attr, "bundle_dts", False)

def _should_produce_flat_module_outs(ctx):
    """Should we produce flat module outputs.

    We only produce flat module outs when we expect the ng_module is meant to be published,
    based on the presence of the module_name attribute.

    Args:
      ctx: skylark rule execution context

    Returns:
      true iff we should run the bundle_index_host to produce flat module metadata and bundle index
    """
    return _is_bazel() and ctx.attr.module_name

# Calculate the expected output of the template compiler for every source in
# in the library. Most of these will be produced as empty files but it is
# unknown, without parsing, which will be empty.
def _expected_outs(ctx):
    devmode_js_files = []
    closure_js_files = []
    declaration_files = []
    transpilation_infos = []
    flat_module_out_prodmode_file = None

    factory_basename_set = depset([_basename_of(ctx, src) for src in ctx.files.factories])

    for src in ctx.files.srcs + ctx.files.assets:
        package_prefix = ctx.label.package + "/" if ctx.label.package else ""

        # Strip external repository name from path if src is from external repository
        # If src is from external repository, it's short_path will be ../<external_repo_name>/...
        short_path = src.short_path if src.short_path[0:2] != ".." else "/".join(src.short_path.split("/")[2:])

        if short_path.endswith(".ts") and not short_path.endswith(".d.ts"):
            basename = short_path[len(package_prefix):-len(".ts")]
            if (len(factory_basename_set.to_list()) == 0 or basename in factory_basename_set.to_list()):
                if _generate_ve_shims(ctx):
                    devmode_js = [
                        ".ngfactory.js",
                        ".ngsummary.js",
                        ".js",
                    ]
                else:
                    devmode_js = [".js"]

                # Only ngc produces .json files, they're not needed in Ivy.
            else:
                devmode_js = [".js"]
                if not _is_bazel():
                    devmode_js += [".ngfactory.js"]
        else:
            continue

        filter_summaries = ctx.attr.filter_summaries
        declarations = [f.replace(".js", ".d.ts") for f in devmode_js]

        for devmode_ext in devmode_js:
            devmode_js_file = ctx.actions.declare_file(basename + devmode_ext)
            devmode_js_files.append(devmode_js_file)

            if not filter_summaries or not devmode_ext.endswith(".ngsummary.js"):
                closure_ext = devmode_ext.replace(".js", ".mjs")
                closure_js_file = ctx.actions.declare_file(basename + closure_ext)
                closure_js_files.append(closure_js_file)
                transpilation_infos.append(struct(closure = closure_js_file, devmode = devmode_js_file))

        declaration_files += [ctx.actions.declare_file(basename + ext) for ext in declarations]

    dts_bundle = None
    if _should_produce_dts_bundle(ctx):
        # We need to add a suffix to bundle as it might collide with the flat module dts.
        # The flat module dts out contains several other exports
        # https://github.com/angular/angular/blob/84406e4d6d93b28b23efbb1701bc5ae1084da67b/packages/compiler-cli/src/metadata/index_writer.ts#L18
        # the file name will be like 'core.bundle.d.ts'
        dts_bundle = ctx.actions.declare_file(ctx.label.name + _FLAT_DTS_FILE_SUFFIX)

    # We do this just when producing a flat module index for a publishable ng_module
    if _should_produce_flat_module_outs(ctx):
        flat_module_out_name = _flat_module_out_file(ctx)

        # Note: We keep track of the prodmode flat module output for `ng_packager` which
        # uses it as entry-point for producing FESM bundles.
        # TODO: Remove flat module from `ng_module` and detect package entry-point reliably
        # in Ivy. Related discussion: https://github.com/angular/angular/pull/36971#issuecomment-625282383.
        flat_module_out_prodmode_file = ctx.actions.declare_file("%s.mjs" % flat_module_out_name)

        closure_js_files.append(flat_module_out_prodmode_file)
        devmode_js_files.append(ctx.actions.declare_file("%s.js" % flat_module_out_name))
        bundle_index_typings = ctx.actions.declare_file("%s.d.ts" % flat_module_out_name)
        declaration_files.append(bundle_index_typings)
    else:
        bundle_index_typings = None

    dev_perf_files = []
    prod_perf_files = []

    # In Ivy mode, dev and prod builds both produce a .json output containing performance metrics
    # from the compiler for that build.
    if is_perf_requested(ctx):
        dev_perf_files = [ctx.actions.declare_file(ctx.label.name + "_perf_dev.json")]
        prod_perf_files = [ctx.actions.declare_file(ctx.label.name + "_perf_prod.json")]

    return struct(
        closure_js = closure_js_files,
        devmode_js = devmode_js_files,
        declarations = declaration_files,
        transpilation_infos = transpilation_infos,
        dts_bundle = dts_bundle,
        bundle_index_typings = bundle_index_typings,
        dev_perf_files = dev_perf_files,
        prod_perf_files = prod_perf_files,
        flat_module_out_prodmode_file = flat_module_out_prodmode_file,
    )

# Determines if we need to generate View Engine shims (.ngfactory and .ngsummary files)
def _generate_ve_shims(ctx):
    return _is_bazel() and getattr(ctx.attr, "generate_ve_shims", False) == True

def _ngc_tsconfig(ctx, files, srcs, **kwargs):
    generate_ve_shims = _generate_ve_shims(ctx)
    compilation_mode = _get_ivy_compilation_mode(ctx)
    is_devmode = "devmode_manifest" in kwargs
    outs = _expected_outs(ctx)
    if is_devmode:
        expected_outs = outs.devmode_js + outs.declarations
    else:
        expected_outs = outs.closure_js

    if not ctx.attr.type_check and ctx.attr.strict_templates:
        fail("Cannot set type_check = False and strict_templates = True for ng_module()")

    if ctx.attr.experimental_extended_template_diagnostics and not ctx.attr.strict_templates:
        fail("Cannot set `experimental_extended_template_diagnostics = True` **and** `strict_templates = False` for `ng_module()`")

    angular_compiler_options = {
        "enableResourceInlining": ctx.attr.inline_resources,
        "generateCodeForLibraries": False,
        "allowEmptyCodegenFiles": True,
        "generateNgFactoryShims": True if generate_ve_shims else False,
        "generateNgSummaryShims": True if generate_ve_shims else False,
        "fullTemplateTypeCheck": ctx.attr.type_check,
        "strictTemplates": ctx.attr.strict_templates,
        "_extendedTemplateDiagnostics": ctx.attr.experimental_extended_template_diagnostics,
        "compilationMode": compilation_mode,
        # In Google3 we still want to use the symbol factory re-exports in order to
        # not break existing apps inside Google. Unlike Bazel, Google3 does not only
        # enforce strict dependencies of source files, but also for generated files
        # (such as the factory files). Therefore in order to avoid that generated files
        # introduce new module dependencies (which aren't explicitly declared), we need
        # to enable external symbol re-exports by default when running with Blaze.
        "createExternalSymbolFactoryReexports": (not _is_bazel()),
        # FIXME: wrong place to de-dupe
        "expectedOut": depset([o.path for o in expected_outs]).to_list(),
        # We instruct the compiler to use the host for import generation in Blaze. By default,
        # module names between source files of the same compilation unit are relative paths. This
        # is not desired in google3 where the generated module names are used as qualified names
        # for aliased exports. We disable relative paths and always use manifest paths in google3.
        "_useHostForImportGeneration": (not _is_bazel()),
        "_useManifestPathsAsModuleName": (not _is_bazel()),
    }

    if is_perf_requested(ctx):
        # In Ivy mode, set the `tracePerformance` Angular compiler option to enable performance
        # metric output.
        if is_devmode:
            perf_path = outs.dev_perf_files[0].path
        else:
            perf_path = outs.prod_perf_files[0].path
        angular_compiler_options["tracePerformance"] = perf_path

    if _should_produce_flat_module_outs(ctx):
        angular_compiler_options["flatModuleId"] = ctx.attr.module_name
        angular_compiler_options["flatModuleOutFile"] = _flat_module_out_file(ctx)
        angular_compiler_options["flatModulePrivateSymbolPrefix"] = "_".join(
            [ctx.workspace_name] + ctx.label.package.split("/") + [ctx.label.name, ""],
        )

    tsconfig = dict(tsc_wrapped_tsconfig(ctx, files, srcs, **kwargs), **{
        "angularCompilerOptions": angular_compiler_options,
    })

    # For prodmode, the compilation target is set to `ES2020`. `@bazel/typecript`
    # using the `create_tsconfig` function sets `ES2015` by default.
    # https://github.com/bazelbuild/rules_nodejs/blob/901df3868e3ceda177d3ed181205e8456a5592ea/third_party/github.com/bazelbuild/rules_typescript/internal/common/tsconfig.bzl#L195
    # TODO(devversion): In the future, combine prodmode and devmode so we can get rid of the
    # ambiguous terminology and concept that can result in slow-down for development workflows.
    if not is_devmode:
        # Note: Keep in sync with the `prodmode_target` for `ts_library` in `tools/defaults.bzl`
        tsconfig["compilerOptions"]["target"] = "es2020"
    else:
        # For devmode output, we use ES2015 to match with what `ts_library` produces by default.
        # https://github.com/bazelbuild/rules_nodejs/blob/9b36274dba34204625579463e3da054a9f42cb47/packages/typescript/internal/build_defs.bzl#L83.
        tsconfig["compilerOptions"]["target"] = "es2015"

    return tsconfig

# Extra options passed to Node when running ngc.
_EXTRA_NODE_OPTIONS_FLAGS = [
    # Expose the v8 garbage collection API to JS.
    "--node_options=--expose-gc",
    # Show ~full stack traces, instead of cutting off after 10 items.
    "--node_options=--stack-trace-limit=100",
    # Give 4 GB RAM to node to allow bigger google3 modules to compile.
    "--node_options=--max-old-space-size=4096",
]

def ngc_compile_action(
        ctx,
        label,
        inputs,
        outputs,
        tsconfig_file,
        node_opts,
        locale = None,
        i18n_args = [],
        dts_bundle_out = None,
        target_flavor = "prodmode"):
    """Helper function to create the ngc action.

    This is exposed for google3 to wire up i18n replay rules, and is not intended
    as part of the public API.

    Args:
      ctx: skylark context
      label: the label of the ng_module being compiled
      inputs: passed to the ngc action's inputs
      outputs: passed to the ngc action's outputs
      tsconfig_file: tsconfig file with settings used for the compilation
      node_opts: list of strings, extra nodejs options.
      locale: i18n locale, or None
      i18n_args: additional command-line arguments to ngc
      dts_bundle_out: produced flattened dts file
      target_flavor: Whether prodmode or devmode output is being built.

    Returns:
      the parameters of the compilation which will be used to replay the ngc action for i18N.
    """

    ngc_compilation_mode = "%s %s" % (_get_ivy_compilation_mode(ctx), target_flavor)

    mnemonic = "AngularTemplateCompile"
    progress_message = "Compiling Angular templates (%s) %s" % (
        ngc_compilation_mode,
        label,
    )

    if locale:
        mnemonic = "AngularI18NMerging"
        supports_workers = "0"
        progress_message = ("Recompiling Angular templates (ngc - %s) %s for locale %s" %
                            (target_flavor, label, locale))
    else:
        supports_workers = str(int(ctx.attr._supports_workers))

    arguments = (list(_EXTRA_NODE_OPTIONS_FLAGS) +
                 ["--node_options=%s" % opt for opt in node_opts])

    # One at-sign makes this a params-file, enabling the worker strategy.
    # Two at-signs escapes the argument so it's passed through to ngc
    # rather than the contents getting expanded.
    if supports_workers == "1":
        arguments += ["@@" + tsconfig_file.path]
    else:
        arguments += ["-p", tsconfig_file.path]

    arguments += i18n_args

    ctx.actions.run(
        progress_message = progress_message,
        mnemonic = mnemonic,
        inputs = inputs,
        outputs = outputs,
        arguments = arguments,
        executable = ctx.executable.compiler,
        execution_requirements = {
            "supports-workers": supports_workers,
        },
    )

    if dts_bundle_out != None:
        # combine the inputs and outputs and filter .d.ts and json files
        filter_inputs = [f for f in inputs.to_list() + outputs if f.path.endswith(".d.ts") or f.path.endswith(".json")]

        if _should_produce_flat_module_outs(ctx):
            dts_entry_point = "%s.d.ts" % _flat_module_out_file(ctx)
        else:
            dts_entry_point = ctx.attr.entry_point.label.name.replace(".ts", ".d.ts")

        ctx.actions.run(
            progress_message = "Bundling DTS (%s) %s" % (target_flavor, str(ctx.label)),
            mnemonic = "APIExtractor",
            executable = ctx.executable.api_extractor,
            inputs = filter_inputs,
            outputs = [dts_bundle_out],
            arguments = [
                tsconfig_file.path,
                "/".join([ctx.bin_dir.path, ctx.label.package, dts_entry_point]),
                dts_bundle_out.path,
            ],
        )

    if not locale and not ctx.attr.no_i18n:
        return struct(
            label = label,
            tsconfig = tsconfig_file,
            inputs = inputs,
            outputs = outputs,
            compiler = ctx.executable.compiler,
        )

    return None

def _filter_ts_inputs(all_inputs):
    # The compiler only needs to see TypeScript sources from the npm dependencies,
    # but may need to look at package.json files as well.
    return [
        f
        for f in all_inputs
        if f.path.endswith(".js") or f.path.endswith(".ts") or f.path.endswith(".json")
    ]

def _compile_action(
        ctx,
        inputs,
        outputs,
        dts_bundle_out,
        perf_out,
        tsconfig_file,
        node_opts,
        target_flavor):
    # Give the Angular compiler all the user-listed assets
    file_inputs = list(ctx.files.assets)

    if (type(inputs) == type([])):
        file_inputs.extend(inputs)
    else:
        # inputs ought to be a list, but allow depset as well
        # so that this can change independently of rules_typescript
        # TODO(alexeagle): remove this case after update (July 2019)
        file_inputs.extend(inputs.to_list())

    if hasattr(ctx.attr, "node_modules"):
        file_inputs.extend(_filter_ts_inputs(ctx.files.node_modules))

    # If the user supplies a tsconfig.json file, the Angular compiler needs to read it
    if hasattr(ctx.attr, "tsconfig") and ctx.file.tsconfig:
        file_inputs.append(ctx.file.tsconfig)
        if TsConfigInfo in ctx.attr.tsconfig:
            file_inputs += ctx.attr.tsconfig[TsConfigInfo].deps

    # Also include files from npm fine grained deps as action_inputs.
    # These deps are identified by the NpmPackageInfo provider.
    for d in ctx.attr.deps:
        if NpmPackageInfo in d:
            # Note: we can't avoid calling .to_list() on sources
            file_inputs.extend(_filter_ts_inputs(d[NpmPackageInfo].sources.to_list()))

    # Collect the inputs and summary files from our deps
    action_inputs = depset(file_inputs)

    return ngc_compile_action(ctx, ctx.label, action_inputs, outputs, tsconfig_file, node_opts, None, [], dts_bundle_out, target_flavor)

def _prodmode_compile_action(ctx, inputs, outputs, tsconfig_file, node_opts):
    outs = _expected_outs(ctx)
    return _compile_action(ctx, inputs, outputs + outs.closure_js + outs.prod_perf_files, None, outs.prod_perf_files, tsconfig_file, node_opts, "prodmode")

def _devmode_compile_action(ctx, inputs, outputs, tsconfig_file, node_opts):
    outs = _expected_outs(ctx)
    compile_action_outputs = outputs + outs.devmode_js + outs.declarations + outs.dev_perf_files
    _compile_action(ctx, inputs, compile_action_outputs, outs.dts_bundle, outs.dev_perf_files, tsconfig_file, node_opts, "devmode")

def _ts_expected_outs(ctx, label, srcs_files = []):
    # rules_typescript expects a function with two or more arguments, but our
    # implementation doesn't use the label(and **kwargs).
    _ignored = [label, srcs_files]
    return _expected_outs(ctx)

def ng_module_impl(ctx, ts_compile_actions):
    """Implementation function for the ng_module rule.

    This is exposed so that google3 can have its own entry point that re-uses this
    and is not meant as a public API.

    Args:
      ctx: the skylark rule context
      ts_compile_actions: generates all the actions to run an ngc compilation

    Returns:
      the result of the ng_module rule as a dict, suitable for
      conversion by ts_providers_dict_to_struct
    """

    providers = ts_compile_actions(
        ctx,
        is_library = True,
        compile_action = _prodmode_compile_action,
        devmode_compile_action = _devmode_compile_action,
        tsc_wrapped_tsconfig = _ngc_tsconfig,
        outputs = _ts_expected_outs,
    )

    outs = _expected_outs(ctx)

    providers["angular"] = {}

    if _should_produce_flat_module_outs(ctx):
        providers["angular"]["flat_module_metadata"] = struct(
            module_name = ctx.attr.module_name,
            typings_file = outs.bundle_index_typings,
            flat_module_out_prodmode_file = outs.flat_module_out_prodmode_file,
        )

    if outs.dts_bundle != None:
        providers["dts_bundle"] = outs.dts_bundle

    return providers

def _ng_module_impl(ctx):
    ts_providers = ng_module_impl(ctx, compile_ts)

    # Add in new JS providers
    # See design doc https://docs.google.com/document/d/1ggkY5RqUkVL4aQLYm7esRW978LgX3GUCnQirrk5E1C0/edit#
    # and issue https://github.com/bazelbuild/rules_nodejs/issues/57 for more details.
    ts_providers["providers"].extend([
        js_module_info(
            sources = ts_providers["typescript"]["es5_sources"],
            deps = ctx.attr.deps,
        ),
        js_named_module_info(
            sources = ts_providers["typescript"]["es5_sources"],
            deps = ctx.attr.deps,
        ),
        js_ecma_script_module_info(
            sources = ts_providers["typescript"]["es6_sources"],
            deps = ctx.attr.deps,
        ),
        # TODO: Add remaining shared JS providers from design doc
        # (JSModuleInfo) and remove legacy "typescript" provider
        # once it is no longer needed.
    ])

    if ctx.attr.package_name:
        path = "/".join([p for p in [ctx.bin_dir.path, ctx.label.workspace_root, ctx.label.package] if p])
        ts_providers["providers"].append(LinkablePackageInfo(
            package_name = ctx.attr.package_name,
            package_path = ctx.attr.package_path,
            path = path,
            files = ts_providers["typescript"]["es5_sources"],
        ))

    return ts_providers_dict_to_struct(ts_providers)

NG_MODULE_ATTRIBUTES = {
    "srcs": attr.label_list(allow_files = [".ts"]),
    "deps": attr.label_list(
        doc = "Targets that are imported by this target",
        aspects = [node_modules_aspect] + DEPS_ASPECTS,
    ),
    "assets": attr.label_list(
        doc = ".html and .css files needed by the Angular compiler",
        allow_files = [
            ".css",
            # TODO(alexeagle): change this to ".ng.html" when usages updated
            ".html",
        ],
    ),
    "factories": attr.label_list(
        allow_files = [".ts", ".html"],
        mandatory = False,
    ),
    "filter_summaries": attr.bool(default = False),
    "type_check": attr.bool(default = True),
    "strict_templates": attr.bool(default = False),
    "experimental_extended_template_diagnostics": attr.bool(
        default = False,
        doc = "Experimental option, not publicly supported.",
    ),
    "inline_resources": attr.bool(default = True),
    "no_i18n": attr.bool(default = False),
    "compiler": attr.label(
        doc = """Sets a different ngc compiler binary to use for this library.

        The default ngc compiler depends on the `//@angular/bazel`
        target which is setup for projects that use bazel managed npm deps that
        fetch the @angular/bazel npm package.
        """,
        default = Label(DEFAULT_NG_COMPILER),
        executable = True,
        cfg = "host",
    ),
    "ng_xi18n": attr.label(
        default = Label(DEFAULT_NG_XI18N),
        executable = True,
        cfg = "host",
    ),
    "_partial_compilation_flag": attr.label(
        default = "@npm//@angular/bazel/src:partial_compilation",
        providers = [NgPartialCompilationInfo],
        doc = "Internal attribute which points to the partial compilation build setting.",
    ),
    # In the angular/angular monorepo, //tools:defaults.bzl wraps the ng_module rule in a macro
    # which sets this attribute to the //packages/compiler-cli:ng_perf flag.
    # This is done to avoid exposing the flag to user projects, which would require:
    # * defining the flag within @angular/bazel and referencing it correctly here, and
    # * committing to the flag and its semantics (including the format of perf JSON files)
    #   as something users can depend upon.
    "perf_flag": attr.label(
        providers = [NgPerfInfo],
        doc = "Private API to control production of performance metric JSON files",
    ),
    "_supports_workers": attr.bool(default = True),

    # Matches the API of the `ts_library` rule from `@bazel/typescript`.
    # https://github.com/bazelbuild/rules_nodejs/blob/398d351a3f2a9b2ebf6fc31fb5882cce7eedfd7b/packages/typescript/internal/build_defs.bzl#L435-L446.
    "package_name": attr.string(
        doc = """The package name that the linker will link this `ng_module` output as.
    If `package_path` is set, the linker will link this package under `<package_path>/node_modules/<package_name>`.
    If `package_path` is not set, the package will be linked in the top-level workspace node_modules folder.""",
    ),

    # Matches the API of the `ts_library` rule from `@bazel/typescript`.
    # https://github.com/bazelbuild/rules_nodejs/blob/398d351a3f2a9b2ebf6fc31fb5882cce7eedfd7b/packages/typescript/internal/build_defs.bzl#L435-L446.
    "package_path": attr.string(
        doc = """The package path in the workspace that the linker will link this `ng_module` output to.
    If `package_path` is set, the linker will link this package under `<package_path>/node_modules/<package_name>`.
    If `package_path` is not set, the package will be linked in the top-level workspace node_modules folder.""",
    ),
}

NG_MODULE_RULE_ATTRS = dict(dict(COMMON_ATTRIBUTES, **NG_MODULE_ATTRIBUTES), **{
    "tsconfig": attr.label(allow_single_file = True),
    "node_modules": attr.label(
        doc = """The npm packages which should be available during the compile.

        The default value of `//typescript:typescript__typings` is
        for projects that use bazel managed npm deps. This default is in place
        since code compiled by ng_module will always depend on at least the
        typescript default libs which are provided by
        `//typescript:typescript__typings`.

        This attribute is DEPRECATED. As of version 0.18.0 the recommended
        approach to npm dependencies is to use fine grained npm dependencies
        which are setup with the `yarn_install` or `npm_install` rules.

        For example, in targets that used a `//:node_modules` filegroup,

        ```
        ng_module(
          name = "my_lib",
          ...
          node_modules = "//:node_modules",
        )
        ```

        which specifies all files within the `//:node_modules` filegroup
        to be inputs to the `my_lib`. Using fine grained npm dependencies,
        `my_lib` is defined with only the npm dependencies that are
        needed:

        ```
        ng_module(
          name = "my_lib",
          ...
          deps = [
              "@npm//@types/foo",
              "@npm//@types/bar",
              "@npm//foo",
              "@npm//bar",
              ...
          ],
        )
        ```

        In this case, only the listed npm packages and their
        transitive deps are includes as inputs to the `my_lib` target
        which reduces the time required to setup the runfiles for this
        target (see https://github.com/bazelbuild/bazel/issues/5153).
        The default typescript libs are also available via the node_modules
        default in this case.

        The @npm external repository and the fine grained npm package
        targets are setup using the `yarn_install` or `npm_install` rule
        in your WORKSPACE file:

        yarn_install(
          name = "npm",
          package_json = "//:package.json",
          yarn_lock = "//:yarn.lock",
        )
        """,
        default = Label(
            
            "//typescript:typescript__typings",
        ),
    ),
    "entry_point": attr.label(allow_single_file = True),

    # Default is %{name}_public_index
    # The suffix points to the generated "bundle index" files that users import from
    # The default is intended to avoid collisions with the users input files.
    # Later packaging rules will point to these generated files as the entry point
    # into the package.
    # See the flatModuleOutFile documentation in
    # https://github.com/angular/angular/blob/master/packages/compiler-cli/src/transformers/api.ts
    "flat_module_out_file": attr.string(),
    "bundle_dts": attr.bool(default = False),
    "api_extractor": attr.label(
        default = Label(DEFAULT_API_EXTRACTOR),
        executable = True,
        cfg = "host",
    ),
    # Should the rule generate ngfactory and ngsummary shim files?
    "generate_ve_shims": attr.bool(default = False),
})

ng_module = rule(
    implementation = _ng_module_impl,
    attrs = NG_MODULE_RULE_ATTRS,
    outputs = COMMON_OUTPUTS,
)
"""
Run the Angular AOT template compiler.

This rule extends the [ts_library] rule.

[ts_library]: https://bazelbuild.github.io/rules_nodejs/TypeScript.html#ts_library
"""

def ng_module_macro(tsconfig = None, **kwargs):
    """Wraps `ng_module` to set the default for the `tsconfig` attribute.

    This must be a macro so that the string is converted to a label in the context of the
    workspace that declares the `ng_module` target, rather than the workspace that defines
    `ng_module`, or the workspace where the build is taking place.

    This macro is re-exported as `ng_module` in the public API.

    Args:
      tsconfig: the label pointing to a tsconfig.json file
      **kwargs: remaining args to pass to the ng_module rule
    """
    if not tsconfig:
        tsconfig = "//:tsconfig.json"

    ng_module(tsconfig = tsconfig, **kwargs)
