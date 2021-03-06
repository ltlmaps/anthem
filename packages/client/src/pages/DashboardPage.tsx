import {
  Button,
  Card,
  Colors,
  Elevation,
  H5,
  H6,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Position,
} from "@blueprintjs/core";
import AddressInputDashboardBar from "components/AddressInputDashboardBar";
import Balance from "components/Balances";
import { KeyActionMap } from "components/KeyboardShortcutsPopover";
import LoginStart from "components/LoginStart";
import Portfolio from "components/Portfolio";
import { Centered, View } from "components/SharedComponents";
import { COLORS } from "constants/colors";
import { IThemeProps } from "containers/ThemeContainer";
import {
  PortfolioHistoryProps,
  withGraphQLVariables,
  withPortfolioHistoryDataQuery,
} from "graphql/queries";
import { History } from "history";
import { PORTFOLIO_CHART_TYPES } from "i18n/english";
import Analytics from "lib/analytics-lib";
import Modules, { ReduxStoreState } from "modules/root";
import { i18nSelector } from "modules/settings/selectors";
import React from "react";
import { connect } from "react-redux";
import { Link, RouteComponentProps, withRouter } from "react-router-dom";
import styled from "styled-components";
import {
  copyTextToClipboard,
  getPortfolioTypeFromUrl,
  onActiveRoute,
} from "tools/client-utils";
import { composeWithProps } from "tools/context-utils";
import { tFnString } from "tools/i18n-utils";
import TransactionSwitchContainer from "transactions/TransactionSwitchContainer";

/** ===========================================================================
 * Types & Config
 * ============================================================================
 */

interface IState {
  portfolioExpanded: boolean;
  transactionExpanded: boolean;
}

const TABS: ReadonlyArray<PORTFOLIO_CHART_TYPES> = [
  "TOTAL",
  "AVAILABLE",
  "STAKING",
  "REWARDS",
  "COMMISSIONS",
];

/** ===========================================================================
 * React Component
 * ============================================================================
 */

class DashboardPage extends React.Component<IProps, IState> {
  addressInput: Nullable<HTMLInputElement> = null;

  constructor(props: IProps) {
    super(props);

    this.state = {
      portfolioExpanded: false,
      transactionExpanded: false,
    };
  }

  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  render(): JSX.Element {
    const { address, ledger } = this.props;

    if (!address) {
      return (
        <DashboardDefaultView>
          <WelcomeTitle>Welcome to Anthem!</WelcomeTitle>
          <LoginStart />
          <Link to="/login">
            <Button icon="arrow-left" style={{ marginTop: 24 }}>
              Exit to Landing Page
            </Button>
          </Link>
        </DashboardDefaultView>
      );
    }

    const { isDesktop, currencySetting, fiatCurrency } = this.props.settings;
    const { t, tString } = this.props.i18n;
    const { portfolioExpanded, transactionExpanded } = this.state;

    const HIDE_TOP_PANEL = transactionExpanded;
    const IS_PORTFOLIO_EXPANDED = portfolioExpanded;
    const DISPLAY_TRANSACTIONS = !portfolioExpanded;

    const PortfolioPanel = (
      <Card elevation={Elevation.TWO} style={getPortfolioCardStyles()}>
        <Row style={{ marginBottom: 10 }}>
          <H5 style={{ margin: 0 }}>{tString("Portfolio")}</H5>
          {isDesktop && (
            <ExpandCollapseIcon onClick={this.togglePortfolioViewSize} />
          )}
        </Row>
        <Portfolio fullSize={portfolioExpanded} />
      </Card>
    );

    const BalancesPanel = (
      <Card elevation={Elevation.TWO} style={getBalanceCardStyles()}>
        <Row>
          <H5 style={{ margin: 0 }}>
            {tString("Balance")} (
            {currencySetting === "crypto"
              ? ledger.network.descriptor
              : fiatCurrency.symbol}
            )
          </H5>
        </Row>
        <Balance address={this.props.address} />
      </Card>
    );

    return (
      <View>
        {this.renderDashboardNavigationLinks()}
        {HIDE_TOP_PANEL ? null : IS_PORTFOLIO_EXPANDED ? (
          PortfolioPanel
        ) : (
          <PortfolioBalanceView>
            {PortfolioPanel}
            {BalancesPanel}
          </PortfolioBalanceView>
        )}
        {DISPLAY_TRANSACTIONS && (
          <View style={{ flex: 1 }}>
            <Row style={{ alignItems: "center" }}>
              <H5 style={{ marginTop: 15, marginBottom: 15, marginLeft: 15 }}>
                {t("Recent Transactions and Events")}
              </H5>
              {isDesktop && (
                <ExpandCollapseIcon onClick={this.toggleTransactionSize} />
              )}
            </Row>
            <TransactionsContainer fullSize={transactionExpanded}>
              <TransactionSwitchContainer />
            </TransactionsContainer>
          </View>
        )}
      </View>
    );
  }

  renderDashboardNavigationLinks = () => {
    const {
      i18n,
      address,
      history,
      settings,
      location,
      portfolioHistory,
    } = this.props;
    const { tString } = i18n;
    const { pathname } = location;

    const commissionsLinkAvailable = shouldShowCommissionsLink(
      portfolioHistory,
    );

    const AVAILABLE_TABS = TABS.filter(tab => {
      if (tab === "COMMISSIONS") {
        return commissionsLinkAvailable;
      } else {
        return true;
      }
    });

    if (settings.isDesktop) {
      return (
        <TopBar>
          {this.state.transactionExpanded ? (
            <DashboardNavigationBar />
          ) : (
            <DashboardNavigationBar>
              {AVAILABLE_TABS.map(title => (
                <DashboardNavigationLink
                  key={title}
                  title={title}
                  address={address}
                  pathname={pathname}
                  localizedTitle={tString(title as PORTFOLIO_CHART_TYPES)}
                />
              ))}
            </DashboardNavigationBar>
          )}
          <AddressInputDashboardBar assignInputRef={this.assignInputRef} />
        </TopBar>
      );
    } else {
      return (
        <View style={{ marginTop: 15, marginBottom: 15 }}>
          <Popover
            content={
              <Menu>
                {AVAILABLE_TABS.map(title =>
                  getMobileDashboardNavigationLink({
                    title,
                    address,
                    history,
                    pathname,
                    localizedTitle: tString(title),
                  }),
                )}
              </Menu>
            }
            position={Position.BOTTOM}
          >
            <Button
              rightIcon="caret-down"
              text={this.getMobileTitle()}
              data-cy="mobile-dashboard-navigation-menu"
            />
          </Popover>
        </View>
      );
    }
  };

  getMobileTitle = () => {
    const { location, i18n } = this.props;
    const { tString } = i18n;
    const portfolioType = getPortfolioTypeFromUrl(location.pathname);

    if (portfolioType) {
      const tabToText = {
        TOTAL: tString("Total"),
        AVAILABLE: tString("Available"),
        REWARDS: tString("Rewards"),
        STAKING: tString("Staking"),
        COMMISSIONS: tString("Commission"),
      };

      const tabTitle = tabToText[portfolioType];

      return `${tString("Viewing")}: ${tabTitle}`;
    }

    return "";
  };

  togglePortfolioViewSize = () => {
    this.setState({
      portfolioExpanded: !this.state.portfolioExpanded,
    });
  };

  toggleTransactionSize = () => {
    this.setState({
      transactionExpanded: !this.state.transactionExpanded,
    });
  };

  handleKeyDown = (event: KeyboardEvent) => {
    if (
      this.props.app.dashboardInputFocused ||
      this.props.ledgerDialog.dialogOpen
    ) {
      return;
    }

    const { keyCode, ctrlKey, altKey, shiftKey, metaKey } = event;
    const anyExtraKeyPress = ctrlKey || altKey || shiftKey || metaKey;

    // Allow accept keypress events with no additional keys held down
    if (anyExtraKeyPress) {
      return;
    }

    const { P, T, I, S, C, Q } = KeyActionMap;

    switch (keyCode) {
      case P.keyCode: {
        if (this.state.transactionExpanded) {
          this.setState({ transactionExpanded: false });
        }

        this.togglePortfolioViewSize();
        break;
      }
      case T.keyCode: {
        if (this.state.portfolioExpanded) {
          this.setState({ portfolioExpanded: false });
        }

        this.toggleTransactionSize();
        break;
      }
      case I.keyCode: {
        event.preventDefault();
        if (event.keyCode === I.keyCode) {
          if (this.addressInput) {
            this.addressInput.focus();
          }
        }
        break;
      }
      case S.keyCode: {
        event.preventDefault();
        this.props.openLedgerDialog({
          signinType: "ADDRESS",
          ledgerAccessType: "SIGNIN",
        });
        break;
      }
      case Q.keyCode: {
        this.props.openLogoutMenu();
        break;
      }
      case C.keyCode: {
        copyTextToClipboard(this.props.address);
        break;
      }
      default: {
        break;
      }
    }
  };

  assignInputRef = (ref: HTMLInputElement) => {
    this.addressInput = ref;
  };
}

/** ===========================================================================
 * Styles and Helpers
 * ============================================================================
 */

const TopBar = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 34px;
  margin-bottom: 14px;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: ${(props: { theme: IThemeProps }) => {
    return props.theme.isDarkTheme ? COLORS.ADDRESS_LINE : Colors.LIGHT_GRAY1;
  }};
`;

const DashboardNavigationBar = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
`;

const PortfolioBalanceView = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-direction: ${(props: { theme: IThemeProps }) =>
    props.theme.isDesktop ? "row" : "column"};
`;

const getPortfolioCardStyles = () => ({
  flex: 2,
  margin: 6,
  borderRadius: 0,
  minHeight: 325,
});

const getBalanceCardStyles = () => ({
  flex: 1,
  margin: 6,
  borderRadius: 0,
  minHeight: 325,
});

interface INavItemProps {
  address: string;
  pathname: string;
  localizedTitle: string;
  title: PORTFOLIO_CHART_TYPES;
}

const TransactionsContainer = styled.div`
  padding: 8px;
  overflow-x: hidden;
  overflow-y: scroll;

  height: ${(props: { theme: IThemeProps } & { fullSize: boolean }) =>
    props.theme.isDesktop
      ? `calc(100vh - ${props.fullSize ? "175px" : "515px"})`
      : "100%"};
`;

export const Row = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
`;

const ExpandCollapseIcon = ({ onClick }: { onClick: () => void }) => (
  <Icon
    iconSize={12}
    icon="fullscreen"
    onClick={onClick}
    color={COLORS.LIGHT_GRAY}
    data-cy="expand-collapse-icon"
    className="expand-collapse-icon"
    style={{ marginLeft: 8, marginRight: 8 }}
  />
);

const DashboardNavigationLink = ({
  title,
  address,
  pathname,
  localizedTitle,
}: INavItemProps) => {
  const params = `?address=${address}`;
  const active = onActiveRoute(pathname, title);
  const path = `${title.toLowerCase()}${params}`;
  const onClickFunction = () => runAnalyticsForTab(title);
  return (
    <Link
      to={path}
      onClick={onClickFunction}
      data-cy={`${title.toLowerCase()}-navigation-link`}
    >
      <NavLinkContainer active={active}>
        {active ? (
          <H6 style={{ color: COLORS.CTA, fontWeight: "bold" }}>
            {localizedTitle}
          </H6>
        ) : (
          <H6 style={{ fontWeight: "bold" }}>{localizedTitle}</H6>
        )}
      </NavLinkContainer>
    </Link>
  );
};

const NavLinkContainer = styled.div`
  height: 30px;
  padding-left: 12px;
  padding-right: 12px;

  border-bottom: ${(props: { active: boolean }) =>
    props.active ? `5px solid ${COLORS.CTA}` : "5px solid none"};

  &:hover {
    cursor: pointer;
  }
`;

const getMobileDashboardNavigationLink = ({
  title,
  history,
  pathname,
  localizedTitle,
}: INavItemProps & { history: History }) => {
  const active = onActiveRoute(pathname, localizedTitle);
  const path = localizedTitle.toLowerCase();
  const onClickFunction = () => {
    history.push(path);
    runAnalyticsForTab(title);
  };
  return (
    <MenuItem
      key={title}
      text={localizedTitle}
      onClick={onClickFunction}
      color={active ? COLORS.CHORUS : undefined}
      data-cy={`${title.toLowerCase()}-navigation-link`}
    />
  );
};

const runAnalyticsForTab = (title: PORTFOLIO_CHART_TYPES): void => {
  if (title === "TOTAL") {
    Analytics.viewPortfolioBalances();
  } else if (title === "REWARDS") {
    Analytics.viewPortfolioRewards();
  }
};

const shouldShowCommissionsLink = (
  portfolioHistory: PortfolioHistoryProps["portfolioHistory"],
) => {
  return (
    portfolioHistory &&
    portfolioHistory.portfolioHistory &&
    portfolioHistory.portfolioHistory.validatorCommissions &&
    portfolioHistory.portfolioHistory.validatorCommissions.length
  );
};

export const DashboardError = ({
  tString,
  text,
}: {
  tString: tFnString;
  text?: string | JSX.Element;
}) => (
  <Centered style={{ marginTop: -25 }}>
    <p style={{ textAlign: "center" }}>
      {text ? text : <b>{tString("Error fetching data...")}</b>}
    </p>
  </Centered>
);

const DashboardDefaultView = styled.div`
  margin-top: -30px;
  height: 100vh;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
`;

const WelcomeTitle = styled.h1``;

/** ===========================================================================
 * Props
 * ============================================================================
 */

const mapStateToProps = (state: ReduxStoreState) => ({
  i18n: i18nSelector(state),
  settings: Modules.selectors.settings(state),
  app: Modules.selectors.app.appSelector(state),
  ledger: Modules.selectors.ledger.ledgerSelector(state),
  address: Modules.selectors.ledger.addressSelector(state),
  ledgerDialog: Modules.selectors.ledger.ledgerDialogSelector(state),
});

const dispatchProps = {
  openLedgerDialog: Modules.actions.ledger.openLedgerDialog,
  openLogoutMenu: Modules.actions.ledger.openLogoutMenu,
};

const withProps = connect(mapStateToProps, dispatchProps);

type ConnectProps = ReturnType<typeof mapStateToProps> & typeof dispatchProps;

interface ComponentProps {}

interface IProps
  extends ComponentProps,
    ConnectProps,
    PortfolioHistoryProps,
    RouteComponentProps {}

/** ===========================================================================
 * Export
 * ============================================================================
 */

export default composeWithProps<ComponentProps>(
  withProps,
  withGraphQLVariables,
  withRouter,
  withPortfolioHistoryDataQuery,
)(DashboardPage);
