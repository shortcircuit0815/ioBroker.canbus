import React from 'react';
import { autobind } from 'core-decorators';

import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import Fab from '@material-ui/core/Fab';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import AddIcon from '@material-ui/icons/Add'
import DeleteIcon from '@material-ui/icons/Delete'
import ConfirmDialog from '@iobroker/adapter-react/Dialogs/Confirm'

import I18n from '@iobroker/adapter-react/i18n';
import { AppContext } from '../common';

import { TabPanel } from './tab-panel';
import { InputCheckbox } from './input-checkbox';
import { InputText } from './input-text';
import { InputSelect } from './input-select';

import { Parser } from './parser';

import { MESSAGE_ID_REGEXP } from '../../../src/consts';
import { uuidv4 } from '../lib/helpers';

interface MessageProps {
  /**
   * The message was changed.
   */
  onChange?: (msgUuid: string, config: ioBroker.AdapterConfigMessage) => void;

  /**
   * The delete button was clicked.
   * If defined, an remove button will be rendered in the top right corner.
   */
  onDelete?: (uuid: string) => void;

  /**
   * The message was validated.
   */
  onValidate?: (uuid: string, isValid: boolean) => void;

  /**
   * The add button was clicked.
   * If defined, an add button will be rendered in the top right corner.
   */
  onAdd?: (uuid: string) => void;

  /**
   * The app context.
   */
  context: AppContext;

  /**
   * UUID of this message.
   */
  uuid: string;

  /**
   * The message config.
   */
  config: ioBroker.AdapterConfigMessage;

  /**
   * Classes to apply for some elements.
   */
  classes: Record<string, string>;

  /**
   * If the message should be readonly.
   */
  readonly?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface MessageState extends ioBroker.AdapterConfigMessage {
  /**
   * Index of the currently selected parser tab.
   */
  tabIndex: number;

  /**
   * Error message for the ID input.
   */
  idError: string | null;

  /**
   * If the remove confirm dialog should be shown.
   */
  showRemoveConfirm: boolean;

  /**
   * Validation status of the configured parsers.
   */
  parsersValid: Record<string, boolean>;
}

export class Message extends React.Component<MessageProps, MessageState> {
  constructor(props: MessageProps) {
    super(props);
    // settings are our state
    this.state = this.validateState({
      tabIndex: 0,
      id: this.props.config.id || '',
      idError: null,
      name: this.props.config.name || '',
      dlc: typeof this.props.config.dlc === 'number' ? this.props.config.dlc : -1,
      receive: this.props.config.receive || false,
      send: this.props.config.send || false,
      autosend: this.props.config.autosend || false,
      parsers: this.props.config.parsers || {},
      parsersValid: {},
      showRemoveConfirm: false
    });
  }

  public componentDidMount(): void {
    // revalidate parseres
    this.validateState();
  }

  public render(): React.ReactNode {
    const { classes, context } = this.props;
    return (
      <>
        {this.props.onDelete && (
          <Fab
            size='small'
            color='primary'
            aria-label='delete'
            className={classes.fabTopRight}
            title={I18n.t('Remove')}
            onClick={() => this.setState({ showRemoveConfirm: true })}
          >
            <DeleteIcon />
          </Fab>
        )}

        {this.props.onAdd && (
          <Fab
            size='small'
            color='primary'
            aria-label='add'
            className={classes.fabTopRight}
            title={I18n.t('Add')}
            onClick={() => this.props.onAdd && this.props.onAdd(this.props.uuid)}
          >
            <AddIcon />
          </Fab>
        )}

        <h2>{I18n.t('Message')}</h2>

        <Grid container spacing={3}>
          <InputText
            sm={6} md={4} lg={2}
            label={I18n.t('Message ID')}
            value={this.state.id}
            required
            errorMsg={this.state.idError}
            disabled={this.props.readonly}
            onChange={(v) => this.handleChange('id', v)}
          >
            {I18n.t('CAN message ID in hex')}, {I18n.t('e.g.')} <code>00A0123B</code> {I18n.t('or')} <code>1AB</code>
          </InputText>
          <InputText
            sm={6} md={4} lg={4}
            label={I18n.t('Name')}
            value={this.state.name}
            disabled={this.props.readonly}
            onChange={(v) => this.handleChange('name', v)}
          >
            {I18n.t('e.g.')} <code>{I18n.t('My super message')}</code>
          </InputText>
          <InputSelect
            sm={6} md={4} lg={3}
            label={I18n.t('Data length')}
            value={this.state.dlc.toString()}
            options={{
              '-1': I18n.t('Not set'),
              '0': '0',
              '1': '1',
              '2': '2',
              '3': '3',
              '4': '4',
              '5': '5',
              '6': '6',
              '7': '7',
              '8': '8',
            }}
            disabled={this.props.readonly}
            onChange={(v) => this.handleChange('dlc', parseInt(v, 10))}
          >
            {I18n.t('Optionally set a fixed data length for this message')}
          </InputSelect>
        </Grid>
        <Grid container spacing={3}>
          <InputCheckbox
            sm={12} md={4} lg={4}
            label={I18n.t('Receive')}
            value={this.state.receive}
            disabled={this.props.readonly}
            onChange={(v) => this.handleChange('receive', v)}
          >
            {I18n.t('Receive messages with the given ID')}
          </InputCheckbox>
          <InputCheckbox
            sm={12} md={4} lg={4}
            label={I18n.t('Send')}
            value={this.state.send}
            disabled={this.props.readonly}
            onChange={(v) => this.handleChange('send', v)}
          >
            {I18n.t('Send messages with the given ID')}
          </InputCheckbox>
          <InputCheckbox
            sm={12} md={4} lg={4}
            label={I18n.t('Autosend')}
            value={this.state.autosend}
            disabled={this.props.readonly}
            onChange={(v) => this.handleChange('autosend', v)}
          >
            {I18n.t('Automatically send the message when some data part changed')}
          </InputCheckbox>
        </Grid>

        <h2>{I18n.t('Parsers')}</h2>

        <div className={classes.root}>
          <Tabs
            orientation='vertical'
            variant='scrollable'
            value={this.state.tabIndex}
            onChange={this.handleTabChange}
            className={classes.tabs}
          >
            {Object.keys(this.state.parsers).map((parserUuid, i) => (
              <Tab
                key={`tab-${i}`}
                label={this.getParserTabLabel(this.state.parsers[parserUuid])}
                id={`${this.props.uuid}-tab-${i}`}
                className={classes.tab}
                style={{
                  color: this.state.parsersValid[parserUuid] === false ? 'red' : undefined,
                  fontStyle: this.state.parsers[parserUuid].id ? undefined : 'italic'
                }}
              />
            ))}

            {!this.props.readonly &&
              <Button color='primary' startIcon={<AddIcon />} onClick={this.onParserAdd}>
                {I18n.t('Add')}
              </Button>
            }
          </Tabs>

          {Object.keys(this.state.parsers).map((parserUuid, i) => (
            <TabPanel key={`tabpanel-${i}`} value={this.state.tabIndex} index={i} className={classes.tabpanel}>
              <Parser
                uuid={parserUuid}
                config={this.state.parsers[parserUuid]}
                msgId={this.state.dlc >= 0 ? `${this.state.id}-${this.state.dlc}` : this.state.id}
                onChange={this.onParserChange}
                onValidate={this.onParserValidate}
                onDelete={this.onParserDelete}
                context={context}
                classes={classes}
                readonly={this.props.readonly}
              />
            </TabPanel>
          ))}
        </div>

        {this.state.showRemoveConfirm &&
          <ConfirmDialog
            title={I18n.t('Remove this message?')}
            text={I18n.t('Are you sure you want to remove this message? This will also remove all it\'s parsers. The message will be treated as unconfigured and may be deleted on adapter restart.')}
            onClose={(ok) => {
              if (ok && this.props.onDelete) {
                this.props.onDelete(this.props.uuid);
              }
              this.setState({ showRemoveConfirm: false });
            }}
          />
        }
      </>
    );
  }

  /**
   * Method to create the label for a parser tab.
   * @param parser The parser config.
   */
  private getParserTabLabel (parser: ioBroker.AdapterConfigMessageParser): string {
    if (!parser?.id) {
      return I18n.t('ID missing');
    }

    if (!parser.name) {
      return parser.id;
    }

    return `${parser.name} (${parser.id})`;
  }

  /**
   * Handler for tab changes.
   */
  @autobind
  private handleTabChange(_event: React.ChangeEvent<any>, newValue: number): void {
    this.setState({ tabIndex: newValue });
  }

  /**
   * Handler for changed inputs.
   * @param key Key of the changed state
   * @param value The new value
   */
  private async handleChange<T extends keyof MessageState>(key: T, value: MessageState[T]): Promise<void> {
    const newState = {
      [key]: value
    } as unknown as Pick<MessageState, keyof MessageState>;

    this.validateState(newState);

    await new Promise((resolve) => {
      this.setState(newState, () => {
        if (this.props.onChange) {
          this.props.onChange(this.props.uuid, {
            id: this.state.id,
            name: this.state.name,
            dlc: this.state.dlc,
            receive: this.state.receive,
            send: this.state.send,
            autosend: this.state.autosend,
            parsers: { ...this.state.parsers },
          });
        }
        resolve();
      });
    });
  }

  /**
   * Validate the state of this component.
   * If no state is given, the previous results will be used and only the parser
   * validation results will be checked.
   * @param state The (partial) state to validate.
   */
  private validateState<T extends Partial<MessageState>>(state: T = {} as T): T {
    let isValid: boolean = true;

    // check own states
    if (state.id !== undefined) {
      // check this
      if (state.id.match(MESSAGE_ID_REGEXP)) {
        state.idError = null;
      } else {
        state.idError = I18n.t('Must be a 3 or 8 char hex ID');
        isValid = false;
      }
    } else if (this.state?.idError !== null) {
      // use result from previous check
      isValid = false;
    }

    // check if parsers in current state are valid
    if (this.state?.parsersValid) {
      for (const uuid in this.state.parsersValid) {
        if (!this.state.parsersValid[uuid]) {
          isValid = false;
        }
      }
    }

    if (this.props.onValidate) {
      this.props.onValidate(this.props.uuid, isValid);
    }

    return state;
  }

  /**
   * Add a new parser.
   */
  @autobind
  private async onParserAdd(): Promise<void> {
    const uuid = uuidv4();
    const parser: ioBroker.AdapterConfigMessageParser = {
      id: '',
      name: '',
      dataType: 'int8',
      dataLength: 1,
      dataOffset: 0,
      dataUnit: '',
      dataEncoding: 'latin1',
      booleanMask: 0,
      booleanInvert: false,
      customScriptRead: '',
      customScriptWrite: ''
    };

    const parsers = { ...this.state.parsers };
    parsers[uuid] = parser;
    await this.handleChange('parsers', parsers);

    // a new parser can't be valid
    await this.onParserValidate(uuid, false);

    this.setState({
      tabIndex: Object.keys(this.state.parsers).length - 1
    });
  }

  /**
   * Handler for validation results of the parsers.
   * @param uuid The UUID of the parser.
   * @param valid If the parser is valid.
   */
  @autobind
  private async onParserValidate(uuid: string, valid: boolean): Promise<void> {
    const parsersValid = { ...this.state.parsersValid };
    parsersValid[uuid] = valid;

    return new Promise((resolve) => {
      this.setState({
        parsersValid: parsersValid
      }, () => {
        // trigger own revalidate to proxy the parser validation state
        this.validateState();

        resolve();
      });
    });
  }

  /**
   * Handler for changes in the parsers.
   * @param uuid The UUID of the parser.
   * @param parser The new parser config.
   */
  @autobind
  private onParserChange(uuid: string, parser: ioBroker.AdapterConfigMessageParser): void {
    const parsers = { ...this.state.parsers };
    parsers[uuid] = parser;
    this.handleChange('parsers', parsers);
  }

  /**
   * Handler for parser delete events.
   * @param uuid The UUID of the parser.
   */
  @autobind
  private async onParserDelete(uuid: string): Promise<void> {
    const parsers = { ...this.state.parsers };
    delete parsers[uuid];
    await this.handleChange('parsers', parsers);

    this.setState({
      tabIndex: this.state.tabIndex - 1
    }, () => {
      // need to set the tabIndex this way because otherwise the selected parser
      // will not be updated if the first parser is deleted
      if (this.state.tabIndex < 0) {
        this.setState({ tabIndex: 0 });
      }
    });
  }
}
