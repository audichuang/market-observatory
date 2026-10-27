enum OverviewReloadReason {
    case dateSelection
    case foreground
    case deepLink

    var dimsExistingContent: Bool {
        switch self {
        case .dateSelection: true
        case .foreground, .deepLink: false
        }
    }
}
