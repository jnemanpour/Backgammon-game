// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "BackgammonEngine",
    products: [
        .library(name: "BackgammonEngine", targets: ["BackgammonEngine"]),
    ],
    targets: [
        .target(name: "BackgammonEngine"),
        .testTarget(
            name: "BackgammonEngineTests",
            dependencies: ["BackgammonEngine"]
        ),
    ]
)
