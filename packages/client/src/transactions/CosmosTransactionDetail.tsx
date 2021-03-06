import { IQuery, ITransaction, TransactionDocument } from "@anthem/utils";
import { GraphQLGuardComponentMultipleQueries } from "components/GraphQLGuardComponents";
import { Centered, DashboardLoader, View } from "components/SharedComponents";
import {
  CosmosTransactionsProps,
  FiatPriceHistoryProps,
  ValidatorsProps,
  withCosmosTransactions,
  withFiatPriceHistory,
  withGraphQLVariables,
  withValidators,
} from "graphql/queries";
import Modules, { ReduxStoreState } from "modules/root";
import { i18nSelector } from "modules/settings/selectors";
import React from "react";
import { Query, QueryResult } from "react-apollo";
import { connect } from "react-redux";
import { RouteComponentProps } from "react-router";
import { withRouter } from "react-router-dom";
import { composeWithProps } from "tools/context-utils";
import CosmosTransactionList from "./CosmosTransactionList";

/** ===========================================================================
 * React Component
 * ============================================================================
 */

class TransactionDetailLoadingContainer extends React.PureComponent<IProps> {
  render(): JSX.Element {
    const { validators, fiatPriceHistory, i18n, ledger } = this.props;
    const txHash = this.props.location.pathname
      .replace("/txs/", "")
      .toLowerCase();

    // Transaction may already exist in Apollo cache. Use this data first.
    const transactionMayExist = this.maybeFindTransactionInApolloCache(txHash);
    if (transactionMayExist) {
      return (
        <View>
          <GraphQLGuardComponentMultipleQueries
            tString={i18n.tString}
            loadingComponent={<DashboardLoader />}
            results={[
              [validators, "validators"],
              [fiatPriceHistory, "fiatPriceHistory"],
            ]}
          >
            {() => this.renderTransaction(transactionMayExist)}
          </GraphQLGuardComponentMultipleQueries>
        </View>
      );
    } else {
      return (
        <View>
          <Query
            query={TransactionDocument}
            variables={{ txHash, network: ledger.network.name }}
          >
            {(
              transaction: QueryResult<{ transaction: IQuery["transaction"] }>,
            ) => {
              return (
                <GraphQLGuardComponentMultipleQueries
                  tString={i18n.tString}
                  loadingComponent={<DashboardLoader />}
                  errorComponent={
                    <View>
                      <Centered
                        style={{ marginTop: 50, flexDirection: "column" }}
                      >
                        <p style={{ fontSize: 16 }}>
                          {this.props.i18n.t(
                            "Transaction could not be found for hash:",
                          )}
                        </p>
                        <p>{txHash}</p>
                      </Centered>
                    </View>
                  }
                  results={[
                    [transaction, ["data", "transaction"]],
                    [validators, "validators"],
                    [fiatPriceHistory, "fiatPriceHistory"],
                  ]}
                >
                  {([transactionResult]: readonly [ITransaction]) => {
                    return this.renderTransaction(transactionResult);
                  }}
                </GraphQLGuardComponentMultipleQueries>
              );
            }}
          </Query>
        </View>
      );
    }
  }

  renderTransaction = (transaction: ITransaction) => {
    return (
      <View>
        <CosmosTransactionList
          {...this.props}
          isDetailView
          transactionsPage={0}
          extraLiveTransactions={[]}
          transactions={transaction ? [transaction] : []}
        />
      </View>
    );
  };

  maybeFindTransactionInApolloCache = (
    hash: string,
  ): Nullable<ITransaction> => {
    const { transactions } = this.props;
    let result = null;

    if (transactions && transactions.cosmosTransactions) {
      result = transactions.cosmosTransactions.data.find(t => t.hash === hash);
    }

    return result || null;
  };
}

/** ===========================================================================
 * Props
 * ============================================================================
 */

const mapStateToProps = (state: ReduxStoreState) => ({
  i18n: i18nSelector(state),
  settings: Modules.selectors.settings(state),
  app: Modules.selectors.app.appSelector(state),
  ledger: Modules.selectors.ledger.ledgerSelector(state),
});

const dispatchProps = {
  setAddress: Modules.actions.ledger.setAddress,
  setTransactionsPage: Modules.actions.transaction.setTransactionsPage,
  removeLocalCopyOfTransaction:
    Modules.actions.transaction.removeLocalCopyOfTransaction,
};

const withProps = connect(mapStateToProps, dispatchProps);

interface ComponentProps {}

type ConnectProps = ReturnType<typeof mapStateToProps> & typeof dispatchProps;

interface IProps
  extends ConnectProps,
    FiatPriceHistoryProps,
    ValidatorsProps,
    CosmosTransactionsProps,
    RouteComponentProps,
    ComponentProps {}

/** ===========================================================================
 * Export
 * ============================================================================
 */

export default composeWithProps<ComponentProps>(
  withRouter,
  withProps,
  withGraphQLVariables,
  withValidators,
  withCosmosTransactions,
  withFiatPriceHistory,
)(TransactionDetailLoadingContainer);
