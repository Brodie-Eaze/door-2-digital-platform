// swift-tools-version: 5.10
//
// D2DKit — shared design tokens, typography, and reusable SwiftUI
// components for the D2D Knocker app. Mirrors @d2d/ui-tokens + @d2d/ui-web
// palette and component names where useful (Card, Button, StatusPill, Money).
//
// Local Swift Package. Add to the D2D Knocker Xcode project via
// File → Add Package Dependencies → Add Local… → select Packages/D2DKit.

import PackageDescription

let package = Package(
    name: "D2DKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "D2DKit", targets: ["D2DKit"]),
    ],
    targets: [
        .target(
            name: "D2DKit",
            path: "Sources/D2DKit"
        ),
        .testTarget(
            name: "D2DKitTests",
            dependencies: ["D2DKit"],
            path: "Tests/D2DKitTests"
        ),
    ]
)
