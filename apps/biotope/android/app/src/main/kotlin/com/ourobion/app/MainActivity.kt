package com.ourobion.app

import io.flutter.embedding.android.FlutterFragmentActivity

// The health plugin (M3 wearables / Health Connect) requires the host Activity to be a
// FragmentActivity/ComponentActivity. Extending FlutterFragmentActivity (instead of the default
// FlutterActivity) avoids the launch-time ClassCastException and lets the plugin attach.
class MainActivity : FlutterFragmentActivity()
