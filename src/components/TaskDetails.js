import PropTypes from 'prop-types';
import React from 'react';
import {withRouter} from 'react-router-dom'
import environment from '../createRelayEnvironment';
import {commitMutation, createFragmentContainer, graphql, requestSubscription} from 'react-relay';
import Chip from 'material-ui/Chip';
import Paper from 'material-ui/Paper';

import TaskCommandList from './TaskCommandList'
import NotificationList from "./NotificationList";
import {isTaskFinalStatus} from "../utils/status";
import {FontIcon, RaisedButton} from "material-ui";
import ReactMarkdown from 'react-markdown';
import BuildBranchNameChip from "./chips/BuildBranchNameChip";
import TaskNameChip from "./chips/TaskNameChip";
import BuildChangeChip from "./chips/BuildChangeChip";
import RepositoryNameChip from "./chips/RepositoryNameChip";
import TaskStatusChip from "./chips/TaskStatusChip";
import TaskCommandsProgress from "./TaskCommandsProgress";
import TaskScheduledChip from "./chips/TaskScheduledChip";
import {hasWritePermissions} from "../utils/permissions";

const taskReRunMutation = graphql`
  mutation TaskDetailsReRunMutation($input: TaskInput!) {
    rerun(input: $input) {
      newTask {
        id
      }
    }
  }
`;

const taskSubscription = graphql`
  subscription TaskDetailsSubscription(
    $taskID: ID!
  ) {
    task(id: $taskID) {
      id
      name
      status
      labels
      creationTimestamp
      executingTimestamp
      durationInSeconds
      statusDurations {
        status
        durationInSeconds
      }
      commands {
        name
        status
        durationInSeconds
      }
      notifications {
        level
        message
      }
    }
  }
`;

class ViewerTaskList extends React.Component {
  static contextTypes = {
    router: PropTypes.object
  };

  componentDidMount() {
    if (isTaskFinalStatus(this.props.task.status)) {
      return
    }

    let variables = {taskID: this.props.task.id};

    this.subscription = requestSubscription(
      environment,
      {
        subscription: taskSubscription,
        variables: variables
      }
    );
  }

  componentWillUnmount() {
    this.closeSubscription();
  }

  closeSubscription() {
    this.subscription && this.subscription.dispose && this.subscription.dispose()
  }

  render() {
    let task = this.props.task;
    let build = task.build;
    let repository = task.repository;

    if (isTaskFinalStatus(task.status)) {
      // no need to be subscripted anymore
      this.closeSubscription();
    }

    let styles = {
      main: {
        paddingTop: 8
      },
      gap: {
        paddingTop: 16
      },
      chip: {
        marginTop: 4,
        marginBottom: 4,
        marginRight: 4,
      },
      wrapper: {
        paddingTop: 16,
        paddingLeft: 0,
        display: 'flex',
        flexWrap: 'wrap',
      },
    };

    let notificationsComponent = !task.notifications ? null :
      <div style={styles.gap}>
        <NotificationList notifications={task.notifications}/>
      </div>;

    let scheduledStatusDuration = task.statusDurations.find(it => it.status === 'SCHEDULED');
    let scheduledDurationChip = scheduledStatusDuration && task.status !== 'SCHEDULED'
      ? <TaskScheduledChip style={styles.chip} duration={scheduledStatusDuration.durationInSeconds}/>
      : null;

    let reRunButton = !hasWritePermissions(repository.viewerPermission) ? null :
      <div className="card-body text-right">
        <RaisedButton label="Re-Run"
                    primary={true}
                    onTouchTap={() => this.rerun(task.id)}
                    icon={<FontIcon className="material-icons">refresh</FontIcon>}
        />
      </div>;
    return (
      <div style={styles.main} className="container">
        <Paper zDepth={2} rounded={false}>
          <div className="card-block">
            <h4 className="card-title text-middle" style={styles.wrapper}>
              <RepositoryNameChip style={styles.chip} repository={repository}/>
              <BuildBranchNameChip style={styles.chip} build={build}/>
              <BuildChangeChip style={styles.chip} build={build}/>
              <TaskNameChip style={styles.chip} task={task}/>
              {scheduledDurationChip}
              <TaskStatusChip style={styles.chip} task={task}/>
            </h4>
            <TaskCommandsProgress task={task}/>
            <div style={styles.gap}>
              <ReactMarkdown className="card-text" source={build.changeMessage}/>
            </div>
            <div className="card-body" style={styles.wrapper}>
              {
                task.labels.map(label => {
                  return <Chip key={label} style={styles.chip}>{label}</Chip>
                })
              }
            </div>
            {reRunButton}
          </div>
        </Paper>
        {notificationsComponent}
        <div style={styles.gap}/>
        <Paper zDepth={2} rounded={false}>
          <TaskCommandList task={task} commands={task.commands}/>
        </Paper>
        <div style={styles.gap}/>
      </div>
    );
  }

  rerun(taskId) {
    const variables = {
      input: {
        clientMutationId: "rerun-" + taskId,
        taskId: taskId,
      },
    };

    commitMutation(
      environment,
      {
        mutation: taskReRunMutation,
        variables: variables,
        onCompleted: (response) => {
          this.context.router.history.push("/task/" + response.rerun.newTask.id)
        },
        onError: err => console.error(err),
      },
    );
  }
}

export default createFragmentContainer(withRouter(ViewerTaskList), {
  task: graphql`
    fragment TaskDetails_task on Task {
      id
      name
      status
      labels
      creationTimestamp
      executingTimestamp
      durationInSeconds
      statusDurations {
        status
        durationInSeconds
      }
      commands {
        name
        status
        durationInSeconds
      }
      notifications {
        level
        message
      }
      build {
        id
        repositoryId
        branch
        changeIdInRepo
        changeTimestamp
        changeMessage
      }
      repository {
        id
        owner
        name
        viewerPermission
      }
    }
  `,
});
