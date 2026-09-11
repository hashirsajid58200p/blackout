const { withAndroidManifest, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withBlackoutNativeModule = (config) => {
  // 1. Android Manifest changes
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const permissionsToAdd = [
      "android.permission.PACKAGE_USAGE_STATS",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.BIND_ACCESSIBILITY_SERVICE",
      "android.permission.QUERY_ALL_PACKAGES",
    ];

    for (const perm of permissionsToAdd) {
      if (!manifest["uses-permission"].some((p) => p["$"]["android:name"] === perm)) {
        manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }

    if (!manifest["queries"]) {
      manifest["queries"] = [];
    }
    if (!manifest["queries"].some((q) => q.intent)) {
      manifest["queries"].push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
            category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
          },
        ],
      });
    }

    const mainApplication = config.modResults.manifest.application[0];

    // Ensure accessibility service is declared
    if (!mainApplication["service"]) {
      mainApplication["service"] = [];
    }

    const serviceName = "com.blackout.app.BlackoutAccessibilityService";
    const existingService = mainApplication["service"].find(
      (s) => s["$"]["android:name"] === serviceName
    );

    if (!existingService) {
      mainApplication["service"].push({
        $: {
          "android:name": serviceName,
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:exported": "true",
          "android:label": "Blackout Accessibility Service",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
    }

    if (!mainApplication["receiver"]) {
      mainApplication["receiver"] = [];
    }

    const receiverName = "com.blackout.app.BlackoutDeviceAdminReceiver";
    const existingReceiver = mainApplication["receiver"].find(
      (r) => r["$"]["android:name"] === receiverName
    );

    if (!existingReceiver) {
      mainApplication["receiver"].push({
        $: {
          "android:name": receiverName,
          "android:permission": "android.permission.BIND_DEVICE_ADMIN",
          "android:exported": "true",
          "android:label": "Blackout Protection",
          "android:description": "@string/device_admin_description",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.app.action.DEVICE_ADMIN_ENABLED",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.app.device_admin",
              "android:resource": "@xml/device_admin",
            },
          },
        ],
      });
    }

    const midnightReceiverName = "com.blackout.app.MidnightResetReceiver";
    const existingMidnightReceiver = mainApplication["receiver"].find(
      (r) => r["$"]["android:name"] === midnightReceiverName
    );

    if (!existingMidnightReceiver) {
      mainApplication["receiver"].push({
        $: {
          "android:name": midnightReceiverName,
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.intent.action.BOOT_COMPLETED",
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });

  // 2. Add native Kotlin source files and xml configs
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resXmlDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "xml"
      );
      const resValuesDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "values"
      );

      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.mkdirSync(resValuesDir, { recursive: true });

      // Ensure accessibility_service_description string exists in strings.xml
      const stringsXmlPath = path.join(resValuesDir, "strings.xml");
      const descString = `<string name="accessibility_service_description">Used by Blackout to detect foreground app launches and enforce app lock limits.</string>`;
      if (fs.existsSync(stringsXmlPath)) {
        let existingContent = fs.readFileSync(stringsXmlPath, "utf8");
        if (!existingContent.includes("accessibility_service_description")) {
          existingContent = existingContent.replace(
            "</resources>",
            `    ${descString}\n</resources>`
          );
          fs.writeFileSync(stringsXmlPath, existingContent);
        }
      } else {
        fs.writeFileSync(
          stringsXmlPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Blackout</string>\n    ${descString}\n</resources>`
        );
      }

      // Create accessibility_service_config.xml
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="false"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100" />
`;
      fs.writeFileSync(
        path.join(resXmlDir, "accessibility_service_config.xml"),
        xmlContent
      );

      // Create device_admin.xml
      const deviceAdminXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <force-lock />
    </uses-policies>
</device-admin>
`;
      fs.writeFileSync(
        path.join(resXmlDir, "device_admin.xml"),
        deviceAdminXmlContent
      );

      return config;
    },
  ]);

  // 3. MainApplication changes to register BlackoutPackage
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("BlackoutPackage()")) {
      contents = contents.replace(
        "val packages = PackageList(this).packages",
        "val packages = PackageList(this).packages.toMutableList()\n            packages.add(BlackoutPackage())"
      );
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withBlackoutNativeModule;
