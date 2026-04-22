pipeline {
    agent any

    environment {
        APP_NAME = "cascara-india"
        NPM = "/home/rastrith156/.nvm/versions/node/v18.20.8/bin/npm"
        SONAR_SCANNER = "/var/lib/jenkins/tools/hudson.plugins.sonar.SonarRunnerInstallation/SonarScanner/bin/sonar-scanner"
    }

    stages {

        stage('Clone') {
            steps {
                git branch: 'main', url: 'https://github.com/Rastrith156/Cascara-India.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('backend') {
                    sh '$NPM install --no-fund --no-audit'
                }
            }
        }

        stage('Lint & Security Audit') {
            steps {
                dir('backend') {
                    sh '$NPM audit --audit-level=high || true'
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                    $SONAR_SCANNER \
                    -Dsonar.projectKey=Cascara-India \
                    -Dsonar.projectName="Cascara India" \
                    -Dsonar.sources=. \
                    -Dsonar.exclusions=**/node_modules/**
                    '''
                }
            }
        }

        stage('Build & Deploy Containers') {
            steps {
                sh '''
                docker stop cascara-container || true
                docker rm cascara-container || true
                docker build -t $APP_NAME .
                docker run -d --name cascara-container -p 80:80 $APP_NAME
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh 'sleep 10 && curl -I http://localhost || true'
            }
        }
    }

    post {
        success { echo '🎉 Success' }
        failure { echo '❌ Failed' }
        always { cleanWs() }
    }
}