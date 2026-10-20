project_name: "lookbase"

application: lookbase {
  label: "LookBase"
  file: "bundle.js"
  mount_points: {
    dashboard_vis: yes
    dashboard_tile: yes
    standalone: yes
  }
  entitlements: {
    local_storage: yes
    use_form_submit: yes
    use_embeds: yes
    core_api_methods: [
      "me",
      "artifact",
      "update_artifacts",
      "delete_artifact",
      "dashboard_dashboard_filters",
      "run_inline_query",
      "query",
      "lookml_model_explore",
      "get_file_content",
      "start_pdt_build",
      "check_pdt_build",
      "stop_pdt_build"
    ]
  }
}
